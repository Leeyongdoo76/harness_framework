export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly userMessage: string;
  abstract readonly retriable: boolean;
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class InvalidUrlError extends AppError {
  readonly code = "INVALID_URL";
  readonly userMessage = "올바른 YouTube 영상 URL이 아닙니다. 다시 확인해주세요.";
  readonly retriable = false;
}

export class YouTubeAuthError extends AppError {
  readonly code = "YT_AUTH";
  readonly userMessage = "YouTube API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요.";
  readonly retriable = false;
}

export class YouTubeQuotaError extends AppError {
  readonly code = "YT_QUOTA";
  readonly userMessage =
    "오늘 YouTube API 사용량 한도를 초과했습니다. 내일 다시 시도하거나 다른 키를 사용해주세요.";
  readonly retriable = false;
}

export class YouTubeNotFoundError extends AppError {
  readonly code = "YT_NOT_FOUND";
  readonly userMessage = "영상을 찾을 수 없습니다. URL을 다시 확인해주세요.";
  readonly retriable = false;
}

export class CommentsDisabledError extends AppError {
  readonly code = "YT_COMMENTS_DISABLED";
  readonly userMessage = "이 영상은 댓글이 꺼져 있어 분석할 수 없습니다.";
  readonly retriable = false;
}

export class YouTubeBadRequestError extends AppError {
  readonly code = "YT_BAD_REQUEST";
  readonly userMessage = "영상 정보를 가져올 수 없습니다. URL을 다시 확인해주세요.";
  readonly retriable = false;
}

export class YouTubeServerError extends AppError {
  readonly code = "YT_SERVER";
  readonly userMessage = "YouTube 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.";
  readonly retriable = true;
}

export class ClaudeAuthError extends AppError {
  readonly code = "AI_AUTH";
  readonly userMessage = "Anthropic API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요.";
  readonly retriable = false;
}

export class ClaudeRateLimitError extends AppError {
  readonly code = "AI_RATE_LIMIT";
  readonly userMessage = "AI 분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  readonly retriable = true;
}

export class ClaudeServerError extends AppError {
  readonly code = "AI_SERVER";
  readonly userMessage = "AI 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.";
  readonly retriable = true;
}

export class ClaudeSchemaError extends AppError {
  readonly code = "AI_SCHEMA";
  readonly userMessage =
    "AI 응답 형식 오류가 반복되어 분석을 완료하지 못했습니다. 다시 시도해주세요.";
  readonly retriable = false;
}

export class ClaudeTokenLimitError extends AppError {
  readonly code = "AI_TOKEN_LIMIT";
  readonly userMessage = "분석 입력이 모델 토큰 한도를 초과했습니다.";
  readonly retriable = false;
}

export class ClaudeMaxTokensError extends AppError {
  readonly code = "AI_MAX_TOKENS";
  readonly userMessage =
    "AI 응답이 잘려서 도착했습니다. 다시 시도하거나, 댓글이 더 적은 다른 영상으로 시도해주세요.";
  readonly retriable = false;
}

export class ClaudeBrowserUnsupportedError extends AppError {
  readonly code = "AI_BROWSER_UNSUPPORTED";
  readonly userMessage =
    "이 브라우저 환경에서 AI 호출이 차단되었습니다. 최신 Chrome/Edge/Firefox/Safari에서 다시 시도해주세요.";
  readonly retriable = false;
}

export class NetworkError extends AppError {
  readonly code = "NETWORK";
  readonly userMessage = "네트워크 연결을 확인해주세요.";
  readonly retriable = true;
}

export class OfflineError extends AppError {
  readonly code = "OFFLINE";
  readonly userMessage = "오프라인입니다. 네트워크 연결을 확인해주세요.";
  readonly retriable = false;
}

export class StorageError extends AppError {
  readonly code = "STORAGE";
  readonly userMessage =
    "브라우저 저장 공간이 부족합니다. 캐시 일부가 저장되지 않을 수 있습니다.";
  readonly retriable = false;
}

export class AbortError extends AppError {
  readonly code = "ABORT";
  readonly userMessage = "";
  readonly retriable = false;
}

export class UnknownError extends AppError {
  readonly code = "UNKNOWN";
  readonly userMessage = "예기치 못한 오류가 발생했습니다. 다시 시도해주세요.";
  readonly retriable = false;
}

export function isAuthError(e: unknown): boolean {
  return e instanceof YouTubeAuthError || e instanceof ClaudeAuthError;
}
