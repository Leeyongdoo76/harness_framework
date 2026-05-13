import Anthropic, {
  APIConnectionError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { maskPIIInReport } from "@/lib/pii";
import { withRetry } from "@/lib/retry";
import {
  AbortError,
  ClaudeAuthError,
  ClaudeBrowserUnsupportedError,
  ClaudeMaxTokensError,
  ClaudeRateLimitError,
  ClaudeSchemaError,
  ClaudeServerError,
  ClaudeTokenLimitError,
  NetworkError,
} from "@/types/errors";
import { ReportSchema, type Report } from "@/types/report";
import type { Comment } from "@/types/youtube";

export type AnalysisResult = Report & { truncatedCount?: number };

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;
const TRUNCATE_TO = 50;

export const SYSTEM_PROMPT = `당신은 유튜브 댓글 분석가다.

[역할]
크리에이터에게 영상의 시청자 반응을 정량+정성적으로 요약한다.

[출력 형식]
반드시 JSON object만 출력. 추가 텍스트/마크다운 금지.
스키마:
{
  "summary": string (한두 문장),
  "detectedLanguage": string (BCP-47, 예: "ko", "en", "ja"),
  "sentiment": { "positive": number, "neutral": number, "negative": number }, // 합 = 100
  "strengths": [{ "point": string, "evidence": string[] }, ...] (0~5개),
  "improvements": [{ "point": string, "evidence": string[] }, ...] (0~5개),
  "keywords": [{ "term": string, "count": number, "sentiment": "pos"|"neu"|"neg" }, ...] (0~15개),
  "notableComments": [{ "text": string, "likes": number, "author": string }, ...] (0~10개)
}

[언어 규칙]
- 댓글의 주 언어를 감지해 summary/strengths/improvements/keywords를 그 언어로 작성.
- 혼합 언어면 가장 많이 쓰인 언어 1개로 통일.

[분석 방향]
- 강점: 시청자가 반복적으로 칭찬한 영상 요소.
- 개선점: 시청자가 불만/요청한 패턴.
- 근거 댓글(evidence)은 입력 댓글에서 발췌. 임의로 생성·각색 금지.
- 충분한 패턴이 없으면 강점/개선점/키워드 배열을 빈 배열로 반환. 억지로 채우지 마라.

[금지]
- 개인 식별 정보(전화번호, 이메일) 노출.
- 입력에 없는 내용 추측.
- 단일 댓글에 의존한 결론.`;

type SystemValue = string | Array<{ type: "text"; text: string }>;

type ParseOutcome =
  | { ok: true; report: Report }
  | { ok: false; violation: string };

function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function buildUserContent(comments: Comment[]): string {
  return JSON.stringify({
    comments: comments.map(({ id, text, likeCount, author }) => ({
      id,
      text,
      likeCount,
      author,
    })),
  });
}

async function callApi(
  client: Anthropic,
  comments: Comment[],
  signal: AbortSignal | undefined,
  systemValue: SystemValue,
): Promise<Message> {
  const requestOptions = signal !== undefined ? { signal } : undefined;
  return await client.messages.create(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemValue,
      messages: [{ role: "user", content: buildUserContent(comments) }],
    },
    requestOptions,
  );
}

function isTokenLimitBadRequest(e: unknown): boolean {
  if (!(e instanceof BadRequestError)) return false;
  const message = e.message ?? "";
  return /token/i.test(message);
}

function extractResponseText(response: Message): string | null {
  const first = response.content[0];
  if (!first || first.type !== "text") return null;
  return first.text;
}

function tryParseReport(text: string): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, violation: `JSON.parse 실패: ${detail}` };
  }
  const result = ReportSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, violation: `zod 검증 실패: ${JSON.stringify(result.error.issues)}` };
  }
  return { ok: true, report: result.data };
}

async function callWithSchemaRetry(
  client: Anthropic,
  comments: Comment[],
  signal: AbortSignal | undefined,
): Promise<Report> {
  const response1 = await callApi(client, comments, signal, SYSTEM_PROMPT);
  if (response1.stop_reason === "max_tokens") {
    throw new ClaudeMaxTokensError("response stopped at max_tokens");
  }
  const text1 = extractResponseText(response1);
  if (text1 === null) {
    throw new ClaudeSchemaError("response did not start with a text content block");
  }

  const first = tryParseReport(text1);
  if (first.ok) return first.report;

  const retrySystem: SystemValue = [
    { type: "text", text: SYSTEM_PROMPT },
    {
      type: "text",
      text:
        `이전 응답이 스키마와 일치하지 않았습니다.\n` +
        `응답: ${text1}\n` +
        `위반: ${first.violation}\n` +
        `반드시 위 스키마를 따르는 JSON object 만 반환하세요.`,
    },
  ];

  const response2 = await callApi(client, comments, signal, retrySystem);
  if (response2.stop_reason === "max_tokens") {
    throw new ClaudeMaxTokensError("response stopped at max_tokens");
  }
  const text2 = extractResponseText(response2);
  if (text2 === null) {
    throw new ClaudeSchemaError("retry response did not start with a text content block");
  }
  const second = tryParseReport(text2);
  if (!second.ok) {
    throw new ClaudeSchemaError(`schema retry failed: ${second.violation}`);
  }
  return second.report;
}

function filterHallucinatedEvidence(report: Report, inputs: Comment[]): Report {
  const texts = inputs.map((c) => c.text);
  const exists = (evidence: string): boolean => texts.some((t) => t.includes(evidence));
  const strengths = report.strengths
    .map((s) => ({ point: s.point, evidence: s.evidence.filter(exists) }))
    .filter((s) => s.evidence.length > 0);
  const improvements = report.improvements
    .map((i) => ({ point: i.point, evidence: i.evidence.filter(exists) }))
    .filter((i) => i.evidence.length > 0);
  return { ...report, strengths, improvements };
}

async function runOnce(
  client: Anthropic,
  comments: Comment[],
  signal: AbortSignal | undefined,
): Promise<AnalysisResult> {
  let activeComments = comments;
  let truncatedCount: number | undefined;

  let report: Report;
  try {
    report = await callWithSchemaRetry(client, activeComments, signal);
  } catch (e) {
    if (!isTokenLimitBadRequest(e)) throw e;
    activeComments = [...comments]
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, TRUNCATE_TO);
    truncatedCount = comments.length - activeComments.length;
    try {
      report = await callWithSchemaRetry(client, activeComments, signal);
    } catch (e2) {
      if (isTokenLimitBadRequest(e2)) {
        throw new ClaudeTokenLimitError("still over token limit after truncation", e2);
      }
      throw e2;
    }
  }

  const filtered = filterHallucinatedEvidence(report, activeComments);
  const masked = maskPIIInReport(filtered);
  return truncatedCount !== undefined ? { ...masked, truncatedCount } : masked;
}

function isRetriableClaudeError(e: unknown): boolean {
  return (
    e instanceof RateLimitError ||
    e instanceof InternalServerError ||
    e instanceof APIConnectionError ||
    e instanceof ClaudeRateLimitError ||
    e instanceof ClaudeServerError ||
    e instanceof NetworkError
  );
}

function mapToClaudeError(e: unknown): Error {
  if (e instanceof AbortError) return e;
  if (e instanceof APIUserAbortError) return new AbortError("aborted", e);
  if (e instanceof Error && e.name === "AbortError") return new AbortError("aborted", e);

  if (
    e instanceof ClaudeAuthError ||
    e instanceof ClaudeRateLimitError ||
    e instanceof ClaudeServerError ||
    e instanceof ClaudeSchemaError ||
    e instanceof ClaudeTokenLimitError ||
    e instanceof ClaudeMaxTokensError ||
    e instanceof ClaudeBrowserUnsupportedError ||
    e instanceof NetworkError
  ) {
    return e;
  }

  if (e instanceof AuthenticationError) return new ClaudeAuthError("authentication failed", e);
  if (e instanceof RateLimitError) return new ClaudeRateLimitError("rate limited", e);
  if (e instanceof InternalServerError) return new ClaudeServerError("server error", e);
  if (e instanceof BadRequestError) {
    if (isTokenLimitBadRequest(e)) return new ClaudeTokenLimitError("token limit exceeded", e);
    return new ClaudeSchemaError(`bad request: ${e.message}`, e);
  }
  if (e instanceof APIConnectionError) return new NetworkError("connection failed", e);
  if (e instanceof TypeError) return new ClaudeBrowserUnsupportedError("browser call blocked", e);
  if (e instanceof Error) return new NetworkError(`unexpected error: ${e.message}`, e);
  return new NetworkError("unexpected error", e);
}

export async function analyzeComments(
  comments: Comment[],
  apiKey: string,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const client = makeClient(apiKey);
  try {
    return await withRetry(() => runOnce(client, comments, signal), {
      maxAttempts: 3,
      baseDelayMs: 1000,
      shouldRetry: isRetriableClaudeError,
      ...(signal !== undefined ? { signal } : {}),
    });
  } catch (e) {
    throw mapToClaudeError(e);
  }
}
