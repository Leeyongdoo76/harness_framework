# Step 1: domain-types

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/PRD.md` — 카피 표 (`code → userMessage` 매핑)
- `/docs/ARCHITECTURE.md` — 디렉토리 구조, 에러 타입 계층, 상태 머신
- `/docs/ADR.md` — ADR-006 (zod 검증), ADR-008 (도메인 에러 계층), ADR-017 (TS strict)

step 0 산출물:
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/test-setup.ts`, `src/App.tsx`

## 작업

`src/types/` 디렉토리에 도메인 타입, zod 스키마, 도메인 에러 클래스를 정의한다. **이 step은 UI/services/lib 없이 types만.**

### 1. `src/types/report.ts`

zod 스키마 + `z.infer` 추론 타입.

```ts
import { z } from "zod";

export const SentimentLabelSchema = z.enum(["pos", "neu", "neg"]);
export type SentimentLabel = z.infer<typeof SentimentLabelSchema>;

export const SentimentSchema = z.object({
  positive: z.number().min(0).max(100),
  neutral: z.number().min(0).max(100),
  negative: z.number().min(0).max(100),
}).refine((s) => Math.abs(s.positive + s.neutral + s.negative - 100) <= 1, {
  message: "sentiment 합이 100이 아닙니다 (오차 ±1 허용)",
});
export type Sentiment = z.infer<typeof SentimentSchema>;

export const StrengthSchema = z.object({
  point: z.string().min(1),
  evidence: z.array(z.string()),
});
export type Strength = z.infer<typeof StrengthSchema>;

export const ImprovementSchema = StrengthSchema;
export type Improvement = z.infer<typeof ImprovementSchema>;

export const KeywordSchema = z.object({
  term: z.string().min(1),
  count: z.number().int().nonnegative(),
  sentiment: SentimentLabelSchema,
});
export type Keyword = z.infer<typeof KeywordSchema>;

export const NotableCommentSchema = z.object({
  text: z.string().min(1),
  likes: z.number().int().nonnegative(),
  author: z.string(),
});
export type NotableComment = z.infer<typeof NotableCommentSchema>;

export const ReportSchema = z.object({
  summary: z.string().min(1),
  detectedLanguage: z.string().min(2),
  sentiment: SentimentSchema,
  strengths: z.array(StrengthSchema).max(5),
  improvements: z.array(ImprovementSchema).max(5),
  keywords: z.array(KeywordSchema).max(15),
  notableComments: z.array(NotableCommentSchema).max(10),
});
export type Report = z.infer<typeof ReportSchema>;
```

`truncatedCount`는 LLM 응답 스키마가 아니므로 Report에 포함시키지 않는다. services에서 후처리로 결과 객체에 별도 부착 (step 5).

### 2. `src/types/videoMeta.ts`

```ts
export type VideoMeta = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  commentCount: number | undefined;
};
```

`videoId`는 branded type 도입하지 말고 `string` 그대로. 형식 검증은 `lib/videoId.ts`에서 보장 (step 2).

### 3. `src/types/youtube.ts`

YouTube API 응답에서 우리가 쓰는 필드만:

```ts
export type YouTubeCommentItem = {
  id: string;
  snippet: {
    topLevelComment: {
      snippet: {
        textOriginal: string;
        authorDisplayName: string | null;
        likeCount: number;
      };
    };
  };
};

export type YouTubeCommentThreadsResponse = { items?: YouTubeCommentItem[] };

export type YouTubeVideoItem = {
  id: string;
  snippet?: {
    title: string;
    channelTitle: string;
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics?: { commentCount?: string };
};

export type YouTubeVideosResponse = { items?: YouTubeVideoItem[] };

export type Comment = {
  id: string;
  text: string;
  likeCount: number;
  author: string;
};
```

### 4. `src/types/errors.ts`

ADR-008 도메인 에러 계층.

```ts
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly userMessage: string;
  abstract readonly retriable: boolean;
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }
}
```

구체 클래스 — ARCHITECTURE 에러 계층 + PRD `code → userMessage` 표 그대로:

| 클래스 | code | retriable | userMessage |
|---|---|---|---|
| `InvalidUrlError` | `INVALID_URL` | false | PRD `INVALID_URL` |
| `YouTubeAuthError` | `YT_AUTH` | false | PRD `YT_AUTH` |
| `YouTubeQuotaError` | `YT_QUOTA` | false | PRD `YT_QUOTA` |
| `YouTubeNotFoundError` | `YT_NOT_FOUND` | false | PRD `YT_NOT_FOUND` |
| `CommentsDisabledError` | `YT_COMMENTS_DISABLED` | false | (UI에서 EmptyState로 변환) |
| `YouTubeBadRequestError` | `YT_BAD_REQUEST` | false | PRD `YT_BAD_REQUEST` |
| `YouTubeServerError` | `YT_SERVER` | true | PRD `YT_SERVER` |
| `ClaudeAuthError` | `AI_AUTH` | false | PRD `AI_AUTH` |
| `ClaudeRateLimitError` | `AI_RATE_LIMIT` | true | PRD `AI_RATE_LIMIT` |
| `ClaudeServerError` | `AI_SERVER` | true | PRD `AI_SERVER` |
| `ClaudeSchemaError` | `AI_SCHEMA` | false | PRD `AI_SCHEMA` |
| `ClaudeTokenLimitError` | `AI_TOKEN_LIMIT` | false | (truncation 경로) |
| `ClaudeMaxTokensError` | `AI_MAX_TOKENS` | false | PRD `AI_MAX_TOKENS` |
| `ClaudeBrowserUnsupportedError` | `AI_BROWSER_UNSUPPORTED` | false | PRD `AI_BROWSER_UNSUPPORTED` |
| `NetworkError` | `NETWORK` | true | PRD `NETWORK` |
| `OfflineError` | `OFFLINE` | false | PRD `OFFLINE` |
| `StorageError` | `STORAGE` | false | PRD `STORAGE` |
| `AbortError` | `ABORT` | false | (UI에 표시 안 함) |
| `UnknownError` | `UNKNOWN` | false | PRD `UNKNOWN` |

`userMessage`는 PRD 카피 표 텍스트 그대로 하드코딩. 후속 step에서 SSOT 일치 검증은 별도 테스트로 추가하지 말고 docs 정합으로 충분.

`isAuthError(e: unknown): boolean` 헬퍼 함수도 export — `e instanceof YouTubeAuthError || e instanceof ClaudeAuthError`.

### 5. `src/types/appState.ts`

ARCHITECTURE "상태 머신" 섹션 그대로:

```ts
import type { AppError } from "./errors";
import type { Report } from "./report";
import type { VideoMeta } from "./videoMeta";
import type { Comment } from "./youtube";

export type VideoId = string;

export type AppState =
  | { kind: "needs_keys" }
  | { kind: "idle"; url?: string }
  | { kind: "metaLoading"; url: string; videoId: VideoId; controller: AbortController }
  | { kind: "metaReady"; videoId: VideoId; videoMeta?: VideoMeta; metaError?: AppError }
  | { kind: "validating"; videoId: VideoId; videoMeta?: VideoMeta; force?: boolean }
  | { kind: "fetching"; videoId: VideoId; videoMeta?: VideoMeta; controller: AbortController }
  | { kind: "analyzing"; videoId: VideoId; videoMeta?: VideoMeta; comments: Comment[]; controller: AbortController }
  | { kind: "result"; videoId: VideoId; videoMeta?: VideoMeta; report: Report; commentCount: number; fromCache: boolean; cachedAt?: string; truncatedCount?: number }
  | { kind: "empty"; videoId: VideoId; videoMeta?: VideoMeta; reason: "commentsDisabled" | "noComments" }
  | { kind: "error"; error: AppError; previous: AppState };

export type Action =
  | { type: "KEYS_SAVED" }
  | { type: "KEYS_CLEARED" }
  | { type: "URL_CHANGED"; url: string }
  | { type: "META_FETCH_REQUESTED"; videoId: VideoId; controller: AbortController }
  | { type: "META_RESULT"; videoMeta?: VideoMeta; metaError?: AppError }
  | { type: "ANALYZE_REQUESTED" }
  | { type: "CACHE_HIT"; report: Report; commentCount: number; cachedAt: string; truncatedCount?: number }
  | { type: "FETCH_STARTED"; controller: AbortController }
  | { type: "ANALYZE_STARTED"; comments: Comment[]; controller: AbortController }
  | { type: "RESULT_READY"; report: Report; truncatedCount?: number }
  | { type: "EMPTY"; reason: "commentsDisabled" | "noComments" }
  | { type: "FAILED"; error: AppError }
  | { type: "CANCELLED" }
  | { type: "RESET_ERROR" }
  | { type: "REANALYZE" }
  | { type: "HASH_VIDEO_ID"; videoId: VideoId; controller: AbortController };
```

### 6. `src/types/copy.ts`

PRD 카피 표 모든 키를 union type으로:

```ts
export type CopyKey =
  | "welcome.intro"
  | "header.title"
  | "header.settings"
  | "header.reanalyze"
  | "status.analysisComplete"
  | "status.fetchingStarted"
  | "status.analyzingStarted"
  | "status.cancelled"
  | "keys.modalTitle"
  | "keys.modalIntro"
  | "keys.youtubeLabel"
  | "keys.youtubePlaceholder"
  | "keys.anthropicLabel"
  | "keys.anthropicPlaceholder"
  | "keys.showToggle"
  | "keys.hideToggle"
  | "keys.save"
  | "keys.guideToggleClosed"
  | "keys.guideToggleOpen"
  | "keys.youtubeGuide"
  | "keys.anthropicGuide"
  | "keys.youtubeGuideLink"
  | "keys.anthropicGuideLink"
  | "keys.deleteAll"
  | "keys.deleteConfirmTitle"
  | "keys.deleteConfirmBody"
  | "keys.deleteConfirmAction"
  | "keys.deleteCancel"
  | "url.label"
  | "url.placeholder"
  | "url.submit"
  | "url.errorInvalidDomain"
  | "url.errorInvalidVideo"
  | "url.errorPlaylist"
  | "url.errorChannel"
  | "meta.previewTitle"
  | "meta.channelLabel"
  | "meta.commentCountLabel"
  | "meta.commentCountFormat"
  | "meta.metaLoadError"
  | "meta.metaAuthError"
  | "progress.fetching"
  | "progress.analyzing"
  | "progress.estimate"
  | "progress.cancel"
  | "result.headerJustNow"
  | "result.headerCached"
  | "result.openVideo"
  | "result.disclaimer"
  | "result.lowConfidence"
  | "result.truncatedNotice"
  | "result.languageLabel"
  | "card.summary"
  | "card.sentiment"
  | "card.strengths"
  | "card.improvements"
  | "card.keywords"
  | "card.notableComments"
  | "sentiment.positive"
  | "sentiment.neutral"
  | "sentiment.negative"
  | "card.emptyStrengths"
  | "card.emptyImprovements"
  | "card.emptyKeywords"
  | "card.emptyNotable"
  | "card.evidenceLabel"
  | "card.evidenceMore"
  | "card.evidenceLess"
  | "card.likesFormat"
  | "empty.commentsDisabledTitle"
  | "empty.commentsDisabledBody"
  | "empty.noCommentsTitle"
  | "empty.noCommentsBody"
  | "error.retry"
  | "error.editUrl"
  | "error.openSettings"
  | "error.refreshPage"
  | "toast.storageFallback"
  | "toast.cacheSaveFailed"
  | "toast.copied"
  | "footer.disclaimer"
  | "footer.privacy"
  | "footer.source"
  | "boundary.title"
  | "boundary.body"
  | "boundary.refresh"
  | "boundary.reportSecondary"
  | "meta.titleDefault"
  | "meta.titleAnalyzing"
  | "meta.titleResult"
  | "meta.description"
  | "relTime.justNow"
  | "relTime.minutesAgo"
  | "relTime.hoursAgo"
  | "relTime.daysAgo"
  | "relTime.weeksAgo"
  | "relTime.over30Days";
```

### 7. 테스트

`src/types/*.test.ts` (또는 `report.test.ts`, `errors.test.ts`):
- `ReportSchema` parse: 정상 응답, sentiment 합 100/99(통과)/90(실패), strengths > 5 (실패), 누락 필드 (실패)
- 각 도메인 에러: 인스턴스화, `code`/`retriable` 값, `instanceof AppError` true, `isAuthError` 분기
- **errors ↔ PRD 카피 일치 검증** (SSOT 보호망): UI 표시 가능한 16종 도메인 에러의 `userMessage`가 PRD `code → userMessage` 표 텍스트와 정확히 일치한다. 예시:
  ```ts
  expect(new YouTubeAuthError("").userMessage).toBe("YouTube API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요.");
  expect(new ClaudeAuthError("").userMessage).toBe("Anthropic API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요.");
  // ... 16종 전체
  ```
  PRD 카피 표가 변경되면 이 테스트가 실패해 동기화를 강제한다. 제외 대상: `CommentsDisabledError` (UI에서 EmptyState로 변환), `ClaudeTokenLimitError` (truncation 경로로 분기), `AbortError` (UI 비표시).

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/types/` 6개 파일(`report`, `videoMeta`, `youtube`, `errors`, `appState`, `copy`) 모두 존재
   - [ ] `ReportSchema` refine이 ±1 오차 허용
   - [ ] 17개 도메인 에러 모두 `code`/`userMessage`/`retriable` 보유
   - [ ] `AppError` abstract (직접 인스턴스화 불가)
   - [ ] `AppState`/`Action` union이 ARCHITECTURE와 1:1
   - [ ] `CopyKey` union이 PRD 카피 표 모든 키 포함
   - [ ] `src/types/` 외 파일 변경 없음
3. index.json 업데이트:
   - 성공 → `"summary": "도메인 타입/스키마/에러 17종 정의. src/types/* 6개 파일 + 테스트."`

## 금지사항

- **services/lib/components 코드 작성 금지.** types만. 이유: 자기완결성.
- **`any`/`!` 금지.** 이유: ADR-017.
- **에러 메시지를 lib/copy에서 lookup하지 마라** (이 step). 일단 PRD 텍스트 하드코딩. 이유: lib/copy는 step 2 산출물.
- **branded type 도입 금지** (`type VideoId = string & { __brand }` 등). string 그대로. 이유: MVP 속도.
- **zod `passthrough()` 금지.** 이유: LLM 임의 필드를 UI에 노출하지 않도록.
