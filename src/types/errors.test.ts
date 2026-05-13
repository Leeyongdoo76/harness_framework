import { describe, expect, it } from "vitest";
import {
  AbortError,
  AppError,
  ClaudeAuthError,
  ClaudeBrowserUnsupportedError,
  ClaudeMaxTokensError,
  ClaudeRateLimitError,
  ClaudeSchemaError,
  ClaudeServerError,
  CommentsDisabledError,
  InvalidUrlError,
  NetworkError,
  OfflineError,
  StorageError,
  UnknownError,
  YouTubeAuthError,
  YouTubeBadRequestError,
  YouTubeNotFoundError,
  YouTubeQuotaError,
  YouTubeServerError,
  isAuthError,
} from "./errors";

describe("AppError 계층", () => {
  it("모든 도메인 에러는 AppError 인스턴스", () => {
    const errors: AppError[] = [
      new InvalidUrlError(""),
      new YouTubeAuthError(""),
      new YouTubeQuotaError(""),
      new YouTubeNotFoundError(""),
      new CommentsDisabledError(""),
      new YouTubeBadRequestError(""),
      new YouTubeServerError(""),
      new ClaudeAuthError(""),
      new ClaudeRateLimitError(""),
      new ClaudeServerError(""),
      new ClaudeSchemaError(""),
      new ClaudeMaxTokensError(""),
      new ClaudeBrowserUnsupportedError(""),
      new NetworkError(""),
      new OfflineError(""),
      new StorageError(""),
      new AbortError(""),
      new UnknownError(""),
    ];
    for (const e of errors) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toBeInstanceOf(Error);
      expect(typeof e.code).toBe("string");
      expect(typeof e.userMessage).toBe("string");
      expect(typeof e.retriable).toBe("boolean");
    }
  });

  it("AppError는 추상 클래스 (타입 시스템이 직접 인스턴스화 차단)", () => {
    // @ts-expect-error abstract class instantiation
    const e = new AppError("x");
    // 런타임에는 막지 않지만 abstract 멤버는 구현이 없어 undefined
    expect(e.code).toBeUndefined();
  });

  it("cause를 옵셔널로 받는다", () => {
    const cause = new Error("inner");
    const e = new NetworkError("outer", cause);
    expect(e.cause).toBe(cause);

    const e2 = new NetworkError("no cause");
    expect(e2.cause).toBeUndefined();
  });

  it("retriable 분류", () => {
    expect(new NetworkError("").retriable).toBe(true);
    expect(new YouTubeServerError("").retriable).toBe(true);
    expect(new ClaudeRateLimitError("").retriable).toBe(true);
    expect(new ClaudeServerError("").retriable).toBe(true);

    expect(new InvalidUrlError("").retriable).toBe(false);
    expect(new YouTubeAuthError("").retriable).toBe(false);
    expect(new ClaudeAuthError("").retriable).toBe(false);
    expect(new AbortError("").retriable).toBe(false);
    expect(new OfflineError("").retriable).toBe(false);
  });

  it("isAuthError는 YT/Claude auth 에러만 true", () => {
    expect(isAuthError(new YouTubeAuthError(""))).toBe(true);
    expect(isAuthError(new ClaudeAuthError(""))).toBe(true);
    expect(isAuthError(new InvalidUrlError(""))).toBe(false);
    expect(isAuthError(new NetworkError(""))).toBe(false);
    expect(isAuthError(new YouTubeQuotaError(""))).toBe(false);
    expect(isAuthError(new Error("plain"))).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
    expect(isAuthError("string")).toBe(false);
  });
});

describe("code 매핑", () => {
  it("각 에러의 code 값", () => {
    expect(new InvalidUrlError("").code).toBe("INVALID_URL");
    expect(new YouTubeAuthError("").code).toBe("YT_AUTH");
    expect(new YouTubeQuotaError("").code).toBe("YT_QUOTA");
    expect(new YouTubeNotFoundError("").code).toBe("YT_NOT_FOUND");
    expect(new CommentsDisabledError("").code).toBe("YT_COMMENTS_DISABLED");
    expect(new YouTubeBadRequestError("").code).toBe("YT_BAD_REQUEST");
    expect(new YouTubeServerError("").code).toBe("YT_SERVER");
    expect(new ClaudeAuthError("").code).toBe("AI_AUTH");
    expect(new ClaudeRateLimitError("").code).toBe("AI_RATE_LIMIT");
    expect(new ClaudeServerError("").code).toBe("AI_SERVER");
    expect(new ClaudeSchemaError("").code).toBe("AI_SCHEMA");
    expect(new ClaudeMaxTokensError("").code).toBe("AI_MAX_TOKENS");
    expect(new ClaudeBrowserUnsupportedError("").code).toBe("AI_BROWSER_UNSUPPORTED");
    expect(new NetworkError("").code).toBe("NETWORK");
    expect(new OfflineError("").code).toBe("OFFLINE");
    expect(new StorageError("").code).toBe("STORAGE");
    expect(new AbortError("").code).toBe("ABORT");
    expect(new UnknownError("").code).toBe("UNKNOWN");
  });
});

describe("userMessage ↔ PRD 카피 표 SSOT 일치", () => {
  it("INVALID_URL", () => {
    expect(new InvalidUrlError("").userMessage).toBe(
      "올바른 YouTube 영상 URL이 아닙니다. 다시 확인해주세요.",
    );
  });
  it("YT_AUTH", () => {
    expect(new YouTubeAuthError("").userMessage).toBe(
      "YouTube API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요.",
    );
  });
  it("YT_QUOTA", () => {
    expect(new YouTubeQuotaError("").userMessage).toBe(
      "오늘 YouTube API 사용량 한도를 초과했습니다. 내일 다시 시도하거나 다른 키를 사용해주세요.",
    );
  });
  it("YT_NOT_FOUND", () => {
    expect(new YouTubeNotFoundError("").userMessage).toBe(
      "영상을 찾을 수 없습니다. URL을 다시 확인해주세요.",
    );
  });
  it("YT_BAD_REQUEST", () => {
    expect(new YouTubeBadRequestError("").userMessage).toBe(
      "영상 정보를 가져올 수 없습니다. URL을 다시 확인해주세요.",
    );
  });
  it("YT_SERVER", () => {
    expect(new YouTubeServerError("").userMessage).toBe(
      "YouTube 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.",
    );
  });
  it("AI_AUTH", () => {
    expect(new ClaudeAuthError("").userMessage).toBe(
      "Anthropic API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요.",
    );
  });
  it("AI_RATE_LIMIT", () => {
    expect(new ClaudeRateLimitError("").userMessage).toBe(
      "AI 분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    );
  });
  it("AI_SERVER", () => {
    expect(new ClaudeServerError("").userMessage).toBe(
      "AI 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.",
    );
  });
  it("AI_SCHEMA", () => {
    expect(new ClaudeSchemaError("").userMessage).toBe(
      "AI 응답 형식 오류가 반복되어 분석을 완료하지 못했습니다. 다시 시도해주세요.",
    );
  });
  it("AI_MAX_TOKENS", () => {
    expect(new ClaudeMaxTokensError("").userMessage).toBe(
      "AI 응답이 잘려서 도착했습니다. 다시 시도하거나, 댓글이 더 적은 다른 영상으로 시도해주세요.",
    );
  });
  it("AI_BROWSER_UNSUPPORTED", () => {
    expect(new ClaudeBrowserUnsupportedError("").userMessage).toBe(
      "이 브라우저 환경에서 AI 호출이 차단되었습니다. 최신 Chrome/Edge/Firefox/Safari에서 다시 시도해주세요.",
    );
  });
  it("NETWORK", () => {
    expect(new NetworkError("").userMessage).toBe("네트워크 연결을 확인해주세요.");
  });
  it("OFFLINE", () => {
    expect(new OfflineError("").userMessage).toBe(
      "오프라인입니다. 네트워크 연결을 확인해주세요.",
    );
  });
  it("STORAGE", () => {
    expect(new StorageError("").userMessage).toBe(
      "브라우저 저장 공간이 부족합니다. 캐시 일부가 저장되지 않을 수 있습니다.",
    );
  });
  it("UNKNOWN", () => {
    expect(new UnknownError("").userMessage).toBe(
      "예기치 못한 오류가 발생했습니다. 다시 시도해주세요.",
    );
  });
});
