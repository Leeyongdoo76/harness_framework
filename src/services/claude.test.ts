import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", async () => {
  const actual = await vi.importActual<typeof import("@anthropic-ai/sdk")>("@anthropic-ai/sdk");
  return {
    ...actual,
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { BadRequestError } from "@anthropic-ai/sdk";
import { ClaudeMaxTokensError, ClaudeSchemaError } from "@/types/errors";
import type { Comment } from "@/types/youtube";
import { analyzeComments } from "./claude";

type MockMessage = {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: Array<{ type: "text"; text: string }>;
  stop_reason: string;
  stop_sequence: null;
  stop_details: null;
  container: null;
  usage: { input_tokens: number; output_tokens: number };
};

function textResponse(text: string, stopReason: string = "end_turn"): MockMessage {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    content: [{ type: "text", text }],
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: null,
    container: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function validReport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    summary: "전반적으로 긍정적인 반응이다.",
    detectedLanguage: "ko",
    sentiment: { positive: 80, neutral: 15, negative: 5 },
    strengths: [],
    improvements: [],
    keywords: [],
    notableComments: [],
    ...overrides,
  };
}

const COMMENTS: Comment[] = [
  { id: "c1", text: "정말 재미있어요!", likeCount: 10, author: "u1" },
  { id: "c2", text: "음악이 좋네요", likeCount: 5, author: "u2" },
];

type CreateCallArgs = {
  model: string;
  max_tokens: number;
  system: string | Array<{ type: string; text: string; cache_control?: unknown }>;
  messages: Array<{ role: string; content: string }>;
};

function getCallArgs(callIndex: number): CreateCallArgs {
  const call = mockCreate.mock.calls.at(callIndex);
  if (!call) throw new Error(`no call at index ${callIndex}`);
  const first = call[0];
  if (typeof first !== "object" || first === null) {
    throw new Error("call args is not an object");
  }
  return first as CreateCallArgs;
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe("analyzeComments", () => {
  it("fixture 1 — non-JSON response twice → ClaudeSchemaError", async () => {
    mockCreate.mockResolvedValueOnce(textResponse("이건 JSON이 아닙니다."));
    mockCreate.mockResolvedValueOnce(textResponse("여전히 JSON 아닙니다."));
    await expect(analyzeComments(COMMENTS, "sk-test")).rejects.toBeInstanceOf(ClaudeSchemaError);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("markdown fence — ```json ... ``` wrapped response is unwrapped and accepted", async () => {
    const wrapped = "```json\n" + JSON.stringify(validReport()) + "\n```";
    mockCreate.mockResolvedValueOnce(textResponse(wrapped));

    const result = await analyzeComments(COMMENTS, "sk-test");

    expect(result.summary).toBe("전반적으로 긍정적인 반응이다.");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("markdown fence — bare ``` ... ``` (no language tag) is also unwrapped", async () => {
    const wrapped = "```\n" + JSON.stringify(validReport()) + "\n```";
    mockCreate.mockResolvedValueOnce(textResponse(wrapped));

    const result = await analyzeComments(COMMENTS, "sk-test");

    expect(result.summary).toBe("전반적으로 긍정적인 반응이다.");
  });

  it("leading/trailing prose — first-brace last-brace extraction recovers", async () => {
    const noisy =
      "다음은 분석 결과입니다:\n" +
      JSON.stringify(validReport()) +
      "\n도움이 되었기를 바랍니다.";
    mockCreate.mockResolvedValueOnce(textResponse(noisy));

    const result = await analyzeComments(COMMENTS, "sk-test");

    expect(result.summary).toBe("전반적으로 긍정적인 반응이다.");
  });

  it("fixture 2 — sentiment sum ≠ 100, then valid → schema retry recovers", async () => {
    const bad = JSON.stringify(
      validReport({ sentiment: { positive: 50, neutral: 30, negative: 30 } }),
    );
    const good = JSON.stringify(validReport());
    mockCreate.mockResolvedValueOnce(textResponse(bad));
    mockCreate.mockResolvedValueOnce(textResponse(good));

    const result = await analyzeComments(COMMENTS, "sk-test");

    expect(result.sentiment).toEqual({ positive: 80, neutral: 15, negative: 5 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // 재시도 호출은 system 을 array 로 보내야 한다 (위반 정보 첨부). cache_control 부착 0건.
    const retryArgs = getCallArgs(1);
    expect(Array.isArray(retryArgs.system)).toBe(true);
    if (Array.isArray(retryArgs.system)) {
      for (const block of retryArgs.system) {
        expect(block).not.toHaveProperty("cache_control");
      }
    }
  });

  it("fixture 3 — hallucinated evidence is filtered out", async () => {
    const report = validReport({
      strengths: [
        { point: "잘 만들었어요", evidence: ["존재하지 않는 댓글입니다"] },
        { point: "음악 좋네요", evidence: ["음악이 좋네요", "허위 evidence"] },
      ],
      improvements: [{ point: "더 길게", evidence: ["허위만 있음"] }],
    });
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify(report)));

    const result = await analyzeComments(COMMENTS, "sk-test");

    expect(result.strengths).toEqual([
      { point: "음악 좋네요", evidence: ["음악이 좋네요"] },
    ]);
    expect(result.improvements).toEqual([]);
  });

  it("fixture 4 — PII in summary is masked", async () => {
    const report = validReport({
      summary: "댓글에 010-1234-5678 같은 전화번호가 있어요 user@example.com",
    });
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify(report)));

    const result = await analyzeComments(COMMENTS, "sk-test");

    expect(result.summary).not.toContain("010-1234-5678");
    expect(result.summary).not.toContain("user@example.com");
    expect(result.summary).toContain("***");
  });

  it("fixture 5 — stop_reason max_tokens → ClaudeMaxTokensError, no retry", async () => {
    mockCreate.mockResolvedValueOnce(textResponse("{}", "max_tokens"));

    await expect(analyzeComments(COMMENTS, "sk-test")).rejects.toBeInstanceOf(
      ClaudeMaxTokensError,
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("token 400 → top-50 truncation retry → success with truncatedCount", async () => {
    const many: Comment[] = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      text: `comment ${i}`,
      likeCount: i,
      author: `u${i}`,
    }));
    const tokenError = new BadRequestError(
      400,
      { message: "input tokens exceed the model maximum" },
      "input tokens exceed the model maximum",
      new Headers(),
    );
    mockCreate.mockRejectedValueOnce(tokenError);
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify(validReport())));

    const result = await analyzeComments(many, "sk-test");

    expect(result.truncatedCount).toBe(50);
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const retryArgs = getCallArgs(1);
    const userContent = retryArgs.messages[0]?.content ?? "";
    const parsedBody = JSON.parse(userContent) as {
      comments: Array<{ likeCount: number }>;
    };
    expect(parsedBody.comments).toHaveLength(50);
    expect(parsedBody.comments[0]?.likeCount).toBe(99);
  });

  it("first call uses system as plain string (no cache_control — ADR-003)", async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify(validReport())));

    await analyzeComments(COMMENTS, "sk-test");

    const firstArgs = getCallArgs(0);
    expect(typeof firstArgs.system).toBe("string");
  });

  it("forwards AbortSignal to SDK request options", async () => {
    mockCreate.mockImplementationOnce(
      (_body: unknown, options: { signal?: AbortSignal } | undefined) => {
        expect(options).toBeDefined();
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve(textResponse(JSON.stringify(validReport())));
      },
    );

    const controller = new AbortController();
    await analyzeComments(COMMENTS, "sk-test", controller.signal);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
