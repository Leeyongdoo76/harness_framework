# 아키텍처

## 디렉토리 구조

```
src/
├── components/
│   ├── Header.tsx                # 타이틀 + 설정 아이콘 + 온라인 상태
│   ├── UrlInput.tsx              # blur/Enter 시 메타 호출 트리거
│   ├── VideoMetaPreview.tsx      # 메타 카드 (성공/실패 모두 표시)
│   ├── ApiKeyModal.tsx           # 키 입력 + 발급 가이드 + 데이터 삭제
│   ├── ConfirmDialog.tsx         # 일반 확인 다이얼로그
│   ├── ProgressIndicator.tsx     # 진행 단계 + 취소 버튼
│   ├── ErrorBanner.tsx           # 도메인 에러 표시 + 복구 동선 버튼
│   ├── EmptyState.tsx            # commentsDisabled / noComments
│   ├── OfflineBanner.tsx         # navigator.onLine 기반 상단 배너
│   ├── Toast.tsx                 # 1회성 안내
│   ├── Footer.tsx                # 면책 / 프라이버시 / 소스 링크
│   ├── ErrorBoundary.tsx         # React ErrorBoundary (클래스 컴포넌트 예외)
│   ├── Dashboard.tsx             # 결과 컨테이너
│   └── cards/
│       ├── SummaryCard.tsx
│       ├── SentimentChart.tsx
│       ├── StrengthsCard.tsx
│       ├── ImprovementsCard.tsx
│       ├── KeywordsCard.tsx
│       └── NotableCommentsCard.tsx
├── types/
│   ├── report.ts                 # zod 스키마 + 추론 타입
│   ├── videoMeta.ts              # 영상 메타 타입
│   ├── errors.ts                 # 도메인 에러 클래스 계층
│   ├── youtube.ts                # YouTube API 응답 타입
│   ├── appState.ts               # 상태 머신 (State, Action)
│   └── copy.ts                   # 카피 키 타입 (PRD 표 기반)
├── lib/
│   ├── videoId.ts                # URL ↔ videoId
│   ├── cache.ts                  # 분석 결과 캐시 (report:*, TTL 30일)
│   ├── metaCache.ts              # 영상 메타 캐시 (videometa:*, TTL 1시간)
│   ├── keys.ts                   # useApiKeys hook
│   ├── storage.ts                # localStorage 추상화 + 인메모리 fallback
│   ├── analyze.ts                # orchestrator
│   ├── retry.ts                  # 지수 백오프
│   ├── reducer.ts                # App useReducer
│   ├── copy.ts                   # PRD 카피 표 객체 + t(key, params)
│   ├── pageTitle.ts              # useDocumentTitle hook
│   ├── urlHash.ts                # useUrlHash hook
│   ├── online.ts                 # useOnlineStatus hook
│   ├── focusTrap.ts              # 모달용 focus trap hook
│   ├── relativeTime.ts           # ISO → "3일 전"
│   ├── pii.ts                    # 응답 PII 마스킹 (전화/이메일 정규식)
│   └── clearAll.ts               # 모든 데이터 삭제 (keys + report + videometa + flag)
├── services/
│   ├── youtube.ts                # commentThreads + videos.list
│   └── claude.ts                 # Anthropic SDK + 프롬프트 + zod + dangerouslyAllowBrowser
├── App.tsx
├── main.tsx
└── index.css                     # Tailwind + fade-in keyframe + reduce-motion query
```

## 컴포넌트 계층

```
ErrorBoundary
└── App
    ├── Header
    │   └── OfflineBanner (offline일 때)
    ├── ApiKeyModal (조건부)
    │   └── ConfirmDialog (데이터 삭제 확인)
    ├── (상태별 분기)
    │   ├── UrlInput
    │   ├── VideoMetaPreview        # 메타 도착 시 (성공/실패 모두)
    │   ├── ProgressIndicator       # fetching/analyzing 시 + 취소 버튼
    │   ├── ErrorBanner             # error 시
    │   ├── EmptyState              # commentsDisabled / noComments
    │   └── Dashboard               # result 시
    │       ├── 결과 헤더
    │       ├── (6개 카드)
    │       └── (면책 카피)
    ├── Toast
    └── Footer
```

## 의존 그래프 (단방향)

```
components → lib → services → 외부 API
components → types
lib → types
services → types
```

- 역방향 금지. 같은 레이어 형제 import 허용.
- `lib/`의 React hook(`useApiKeys`, `useOnlineStatus`, `useDocumentTitle`, `useUrlHash`, `useFocusTrap`)은 lib에 둠. components만 호출.

## 상태 머신 (`lib/reducer.ts`)

### 상태

```ts
type AppState =
  | { kind: "needs_keys" }
  | { kind: "idle"; url?: string }
  | { kind: "metaLoading"; url: string; videoId: VideoId; controller: AbortController }
  | { kind: "metaReady"; videoId: VideoId; videoMeta?: VideoMeta; metaError?: AppError }
  | { kind: "validating"; videoId: VideoId; videoMeta?: VideoMeta }
  | { kind: "fetching"; videoId: VideoId; videoMeta?: VideoMeta; controller: AbortController }
  | { kind: "analyzing"; videoId: VideoId; videoMeta?: VideoMeta; comments: Comment[]; controller: AbortController }
  | { kind: "result"; videoId: VideoId; videoMeta?: VideoMeta; report: Report; fromCache: boolean; cachedAt?: string; truncatedCount?: number }
  | { kind: "empty"; videoId: VideoId; videoMeta?: VideoMeta; reason: "commentsDisabled" | "noComments" }
  | { kind: "error"; error: AppError; previous: AppState };
```

`error.previous`는 **재귀적 error를 가질 수 없다** — error 중첩 시 기존 previous를 그대로 유지한다 (아래 FAILED 전이 참조).

### 액션

```ts
type Action =
  | { type: "KEYS_SAVED" }
  | { type: "KEYS_CLEARED" }
  | { type: "URL_CHANGED"; url: string }                 // 입력 onChange (검증만)
  | { type: "META_FETCH_REQUESTED"; videoId: VideoId; controller: AbortController }  // blur/Enter
  | { type: "META_RESULT"; videoMeta?: VideoMeta; metaError?: AppError }
  | { type: "ANALYZE_REQUESTED" }
  | { type: "CACHE_HIT"; report: Report; cachedAt: string }
  | { type: "FETCH_STARTED"; controller: AbortController }
  | { type: "ANALYZE_STARTED"; comments: Comment[]; controller: AbortController }
  | { type: "RESULT_READY"; report: Report; truncatedCount?: number }
  | { type: "EMPTY"; reason: "commentsDisabled" | "noComments" }
  | { type: "FAILED"; error: AppError }
  | { type: "CANCELLED" }
  | { type: "RESET_ERROR" }
  | { type: "REANALYZE" }
  | { type: "HASH_VIDEO_ID"; videoId: VideoId };
```

### 전이

```
needs_keys → idle              : KEYS_SAVED
* → needs_keys                 : KEYS_CLEARED

idle → idle                    : URL_CHANGED (형식 검증만, 호출 없음)
idle → metaLoading             : META_FETCH_REQUESTED (blur/Enter, videoId de-dupe)
* → metaLoading                : HASH_VIDEO_ID (페이지 진입 hash 발견)

metaLoading → metaLoading      : URL_CHANGED (다른 videoId면 controller.abort() 후 새 호출)
metaLoading → idle             : URL_CHANGED with invalid/empty (controller.abort())
metaLoading → metaReady        : META_RESULT (videoMeta 또는 metaError. stale 응답은 drop)

metaReady → metaLoading        : URL_CHANGED with new videoId
metaReady → idle               : URL_CHANGED with invalid/empty
metaReady → validating         : ANALYZE_REQUESTED (URL hash 갱신 직후)
metaReady → needs_keys         : metaError가 AuthError면 모달 자동 오픈

validating → result            : CACHE_HIT
validating → fetching          : FETCH_STARTED

fetching → analyzing           : ANALYZE_STARTED
fetching → empty               : EMPTY
* (metaLoading/fetching/analyzing) → idle : CANCELLED (controller.abort())

analyzing → result             : RESULT_READY

* → error (previous=current)   : FAILED
  - 단 current.kind === "error" 일 때는 previous를 새로 만들지 않고 기존 previous 유지
  - AbortError는 FAILED 디스패치하지 않음 (의도된 취소)

error → previous               : RESET_ERROR
error → previous               : KEYS_SAVED (인증 에러 복구 시 자동 — idle 아님)

result → validating            : REANALYZE (force=true, 캐시 무시)
empty → metaLoading            : URL_CHANGED with new videoId
```

`useReducer`로 구현. controller는 상태에 포함시켜 다음 전이에 abort.

## 데이터 흐름

```
[URL 입력 (blur or Enter)]
  ↓ trim
  ↓ lib/videoId.ts: parseVideoId(url) → VideoId | InvalidUrlError
  ↓ (videoId 변화 없으면 호출 skip)
  ↓ lib/metaCache.ts: getMeta(videoId) → VideoMeta | null (TTL 1시간)
  │
  ├─ hit  → metaReady (즉시 VideoMetaPreview)
  └─ miss ↓
  ↓ services/youtube.ts: fetchVideoMeta(videoId, ytKey, signal) → VideoMeta
  │   (4xx auth → AuthError throw, 404 → NotFoundError throw, 5xx/network → undefined silent)
  ↓
[URL hash 갱신: #v={videoId} (replaceState)]
  ↓
[VideoMetaPreview 표시 + "분석 시작" 활성화]
  ↓ "분석 시작" 클릭
  ↓ lib/cache.ts: getReport(videoId) → CachedEntry | null (TTL 30일)
  ├─ hit → Dashboard 렌더 (END)
  └─ miss ↓
  ↓ services/youtube.ts: fetchTopComments(videoId, ytKey, signal)
  │   (4xx → 도메인 에러 / 5xx → retry 1회 / commentsDisabled → empty / 0개 → empty)
  ↓
  ↓ services/claude.ts: analyzeComments(comments, anthKey, signal)
  │   - SDK 옵션: { dangerouslyAllowBrowser: true }
  │   - system: SYSTEM_PROMPT (string. ADR-003 — cache_control 미사용)
  │   - token 초과 → top-50 truncation 1회 / schema 실패 → 1회 retry
  ↓
  ↓ types/report.ts: ReportSchema.parse → Report
  ↓
  ↓ lib/pii.ts: maskPII(report) → Report (전화/이메일 마스킹)
  ↓
  ↓ evidence 필터링 (입력 댓글에 존재 검사, hallucinated 제거)
  ↓
  ↓ lib/cache.ts: setReport(videoId, { schemaVersion, createdAt, videoMeta, report })
  ↓
  ↓ lib/pageTitle.ts: title = "{videoTitle} - 분석 결과"
  ↓
[Dashboard 렌더 + aria-live polite: status.analysisComplete]
```

## 에러 타입 계층 (`types/errors.ts`)

```
AppError (abstract)
├── InvalidUrlError
├── YouTubeApiError (abstract)
│   ├── YouTubeAuthError         # 401/403 invalid_key
│   ├── YouTubeQuotaError        # 403 quotaExceeded
│   ├── YouTubeNotFoundError     # 404 OR 200+items=[]
│   ├── CommentsDisabledError    # 403 commentsDisabled (empty 상태)
│   ├── YouTubeBadRequestError   # 400
│   └── YouTubeServerError       # 5xx
├── ClaudeApiError (abstract)
│   ├── ClaudeAuthError          # 401
│   ├── ClaudeRateLimitError     # 429
│   ├── ClaudeServerError        # 5xx / 529
│   ├── ClaudeSchemaError        # JSON parse 실패 OR zod 실패
│   ├── ClaudeTokenLimitError    # 토큰 초과
│   ├── ClaudeMaxTokensError     # stop_reason: max_tokens
│   └── ClaudeBrowserUnsupportedError  # CORS/SDK 차단
├── NetworkError
├── OfflineError
├── StorageError
├── AbortError                   # 사용자에게 표시 안 함
└── UnknownError
```

공통:
```ts
abstract class AppError extends Error {
  abstract code: string;
  abstract userMessage: string;
  cause?: unknown;
  retriable: boolean;
}
```

- services가 raw 에러 → 도메인 에러로 변환
- 컴포넌트는 `code` 분기 + `userMessage` 표시
- AbortError는 사용자에게 표시 안 함

## 재시도 정책 (`lib/retry.ts`)

```ts
type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry: (e: unknown) => boolean;
  signal?: AbortSignal;
};
```

- 백오프: `baseDelayMs * 2^(attempt - 1)`
- `signal.aborted` 즉시 AbortError, sleep 중에도 깨움

| 호출 | maxAttempts | retry 대상 |
|---|---|---|
| YouTube videos.list | 1 (재시도 없음) | — |
| YouTube commentThreads | 2 | 5xx, NetworkError |
| Anthropic | 3 | 429, 5xx/529, NetworkError |
| Claude schema (별도) | 2 | ClaudeSchemaError만 |

## 캐시 정책

### 분석 결과 캐시 (`lib/cache.ts`)
- 키: `report:{videoId}`
- 값: `{ schemaVersion: 1, createdAt: ISO8601, videoMeta?: VideoMeta, report: Report }`
- TTL 30일
- 스키마 mismatch / JSON 손상 / TTL 만료 → 삭제 후 miss
- quota 초과 → LRU 1개 제거 후 재시도 → 또 실패면 `toast.cacheSaveFailed`

### 영상 메타 캐시 (`lib/metaCache.ts`)
- 키: `videometa:{videoId}`
- 값: `{ schemaVersion: 1, fetchedAt: ISO8601, videoMeta: VideoMeta }`
- TTL 1시간 (메타는 자주 안 변함, BYOK 쿼터 보호)
- 같은 정책 (스키마/손상/만료 → miss)

## 저장소 추상화 (`lib/storage.ts`)

```ts
interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

function getStore(): KVStore;
function isUsingFallback(): boolean;
```

- 기본: localStorage
- SecurityError/DOMException → 인메모리 Map fallback + `toast.storageFallback` 1회

## API 키 관리 (`lib/keys.ts`)

```ts
type ApiKeys = { youtube: string; anthropic: string };
function loadKeys(): ApiKeys | null;
function saveKeys(keys: ApiKeys): void;
function clearKeys(): void;
function maskKey(key: string): string;

function useApiKeys(): {
  keys: ApiKeys | null;
  save: (keys: ApiKeys) => void;
  clear: () => void;
};
```

- 저장 키: `keys:youtube`, `keys:anthropic`
- `useSyncExternalStore`로 컴포넌트 동기화
- 빈 문자열만 차단

## 데이터 삭제 (`lib/clearAll.ts`)

```ts
function clearAll(): void;
```
- prefix 4종 전부 제거: `keys:*`, `report:*`, `videometa:*`, `flag:*`
- 호출 후 `KEYS_CLEARED` 디스패치 → needs_keys

## 비동기 취소

- reducer가 metaLoading/fetching/analyzing 상태에 controller 보유
- URL_CHANGED(다른 videoId), ANALYZE_REQUESTED, CANCELLED, KEYS_CLEARED → 이전 abort
- services에 signal 주입:
  - fetch: `fetch(url, { signal })`
  - Anthropic SDK: 호출 옵션 `signal` (SDK 미지원 시 catch에서 AbortError)
- stale 응답 drop: 도착 시 controller가 reducer의 현재 controller와 다르면 무시

## 네트워크 상태 (`lib/online.ts`)

```ts
function useOnlineStatus(): boolean;
```

- App이 구독. offline 진입 시 OfflineBanner + 진행 중 분석 abort + `OfflineError` dispatch.
- online 복귀 시 배너 사라짐. 자동 재시도 없음.

## URL hash 동기화 (`lib/urlHash.ts`)

```ts
function useUrlHash(): {
  videoId: VideoId | null;
  setVideoId: (id: VideoId | null) => void;
};
```

- 형식: `#v={videoId}`
- 페이지 첫 진입 시 hash에서 추출 → `HASH_VIDEO_ID` 디스패치 → metaLoading
- **"분석 시작" 클릭 (ANALYZE_REQUESTED) 직후** hash 갱신 (`history.replaceState`로 history 오염 방지)
- hashchange 이벤트(뒤로/앞으로) → 변경된 videoId로 metaLoading 다시 진입

## 페이지 title (`lib/pageTitle.ts`)

```ts
function useDocumentTitle(title: string): void;
```

- 상태별:
  - needs_keys / idle / metaLoading / metaReady / validating → `meta.titleDefault` (영상 제목이 있으면 그것)
  - fetching / analyzing → `meta.titleAnalyzing`
  - result → `meta.titleResult` (videoTitle 또는 videoId fallback)
  - empty / error → 직전 상태와 동일

## focus management (`lib/focusTrap.ts`)

```ts
function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean): void;
```

- 활성화: 첫 focusable에 focus, Tab/Shift+Tab trap, ESC 핸들러 호출 (닫기 가능한 모달만)
- 비활성화: 활성화 전 focus로 복귀

추가:
- 분석 결과 도착 시 Dashboard 컨테이너 `tabIndex={-1}` + `ref.current.focus()`
- ErrorBanner 표시 시 banner에 focus + `role="alert"`

## aria-live 영역

- App 최상단에 시각적으로 숨겨진 두 영역:
  - `<div role="status" aria-live="polite">` — 진행 단계 변경, 결과 도착 (`status.analysisComplete`)
  - `<div role="alert" aria-live="assertive">` — 에러 발생 시 `userMessage`

## Toast 시스템 (`components/Toast.tsx`)

- 단일 인스턴스
- App 상태에 `toast: { kind: ToastKind; shownAt: number } | null`
- 4초 후 자동 사라짐
- 같은 kind 연속 호출 시 합치기

## 영상 메타 조회 (`services/youtube.ts`)

```ts
function fetchVideoMeta(videoId: VideoId, apiKey: string, signal?: AbortSignal): Promise<VideoMeta>;
function fetchTopComments(videoId: VideoId, apiKey: string, signal?: AbortSignal): Promise<Comment[]>;
```

`fetchVideoMeta`:
- `videos.list?part=snippet,statistics&id={videoId}`
- 응답 처리:
  - 200 + items 있음 → VideoMeta 반환
  - 200 + items 빈 배열 → `YouTubeNotFoundError` throw
  - 401/403 invalid_key → `YouTubeAuthError` throw
  - 404 → `YouTubeNotFoundError` throw
  - 5xx → `YouTubeServerError` throw (UI는 silent 처리)
  - 네트워크 → `NetworkError` throw (UI는 silent 처리)
- AbortError는 그대로 throw

`fetchTopComments`: `commentThreads.list?part=snippet&maxResults=100&order=relevance&textFormat=plainText&videoId={videoId}`. **`pageToken`은 사용하지 않는다.** 첫 응답의 톱-레벨만.

## Claude 호출 (`services/claude.ts`)

### SDK 초기화
```ts
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({
  apiKey: anthropicKey,
  dangerouslyAllowBrowser: true,   // BYOK 브라우저 호출 (ADR-031)
});
```

### 호출 형식
```ts
await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 4096,
  system: SYSTEM_PROMPT,  // string. ADR-003 — cache_control 미사용 (SYSTEM_PROMPT 가 캐시 임계값 미달, PoC 검증)
  messages: [
    {
      role: "user",
      content: JSON.stringify({ comments }),
    },
  ],
}, { signal });
```

### System 프롬프트 (`SYSTEM_PROMPT`)

```
당신은 유튜브 댓글 분석가다.

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
- 단일 댓글에 의존한 결론.
```

### 응답 처리

1. `JSON.parse(response.content[0].text)`
2. `ReportSchema.parse(parsed)` — zod (sentiment 합 = 100, evidence는 string[], 등)
3. zod 실패 시 위반 정보를 system에 추가해 1회 재시도
4. 통과 시 후처리:
   - evidence 필터링: 각 evidence 문자열이 입력 댓글 텍스트와 substring 일치하는지 검사. 일치하지 않으면 제거. 결과 evidence가 빈 배열이면 해당 strength/improvement 항목 제거.
   - PII 마스킹: `lib/pii.ts`로 summary/strengths/improvements/notableComments의 텍스트 필드에서 전화/이메일 정규식 매칭 → `***-****-****` / `***@***`
5. CORS/SDK 차단 (`fetch` reject with TypeError) → `ClaudeBrowserUnsupportedError` throw

### Browser 호출 가능성 검증
- step 0의 PoC에서 `dangerouslyAllowBrowser: true`로 Anthropic 호출 1회 시도해 200이 오는지 확인 (ADR-031). 실패 시 step 0가 blocked로 종료되고 사용자에게 보고.

## 토큰 / 비용 관리

- 댓글 100개 평균 input ~10K, output ~2K → Haiku 4.5 저렴
- prompt caching 미사용 (ADR-003 — SYSTEM_PROMPT 가 캐시 임계값 미달, 비용 차이 무의미)
- 토큰 한도 초과 응답 → likeCount 내림차순 상위 50개로 자르고 1회 재시도
- Report에 `truncatedCount?: number` (services 후처리로 추가)

## 보안

- API 키 localStorage 평문 (BYOK 한계). 화면 표시는 마스킹.
- `dangerouslySetInnerHTML` 금지. 댓글은 React 기본 escape.
- CSP 메타 태그 (`index.html`):
  ```
  default-src 'self';
  script-src 'self';
  base-uri 'none';
  object-src 'none';
  form-action 'none';
  connect-src 'self' https://www.googleapis.com https://youtube.googleapis.com https://api.anthropic.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://i.ytimg.com data:;
  font-src 'self';
  ```
- 외부 링크 `target="_blank" rel="noopener noreferrer"`
- 사용자 입력 URL은 fetch에 직접 안 넣음 — videoId만 추출

## 빌드 / 배포

- `npm run build` = `tsc --noEmit && vite build` → `dist/`
- 환경변수 사용 금지
- GitHub Pages 사용 시 `vite.config.ts`의 `base: "/{repo}/"`

## 반응형 / 접근성 구현

### 반응형
- Tailwind breakpoint: `sm: 640px`, `md: 768px`, `lg: 1024px`
- Dashboard 그리드: 모바일 `grid-cols-1`, `md:grid-cols-2`, `lg:grid-cols-2`
- 이미지/썸네일 `w-full h-auto`
- iOS 안전 영역: 푸터 `pb-[env(safe-area-inset-bottom)]`

### prefers-reduced-motion
- `index.css`: `@media (prefers-reduced-motion: reduce) { .fade-in { animation: none; } * { transition: none !important; } }`

### focus ring
- 모든 인터랙티브 element: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]`

### 차트 접근성
- Recharts에 `aria-label` + 차트 옆 시각적으로 숨긴 `<ul>` 텍스트 대안 ("긍정 78%, 중립 15%, 부정 7%")

## 테스트 전략

| 레이어 | 도구 | 범위 |
|---|---|---|
| `lib/`, `types/` 순수 로직 | Vitest | 100% 분기. videoId, cache, metaCache, retry, reducer, pii |
| `services/` | Vitest + fetch mock + SDK mock | status code별 에러 변환, 재시도 호출 횟수, abort 처리 |
| `services/claude.ts` fixture | Vitest | 비-JSON 응답 / sentiment 합 ≠ 100 / hallucinated evidence / PII 포함 (전화/이메일) / stop_reason=max_tokens / token 초과 |
| `components/` | @testing-library/react + happy-dom + user-event | 상태별 렌더, 인터랙션, focus trap, aria-live |
| 상태 머신 | Vitest | (state, action) 매트릭스. 특히 metaLoading 취소/교체, error 중첩 방지, KEYS_SAVED → previous |
| **e2e smoke** | **Playwright** | 키 모달 입력 → 분석(mock fixture) → 결과 렌더 / hash 새로고침 복원 / 모바일 뷰포트 가로 스크롤 없음 / CSP 콘솔 오류 없음 |

## 상태 ↔ 컴포넌트 매핑

| App 상태 | 표시 |
|---|---|
| `needs_keys` | Header + ApiKeyModal (닫기 불가) + Footer |
| `idle` | Header + UrlInput + Footer |
| `metaLoading` | Header + UrlInput + 메타 스켈레톤 |
| `metaReady` (메타 OK) | Header + UrlInput + VideoMetaPreview + "분석 시작" |
| `metaReady` (메타 실패 silent) | Header + UrlInput + 간단 fallback 카드 (`[videoId]`) + "분석 시작" |
| `validating` | Header + VideoMetaPreview + 짧은 스피너 |
| `fetching` | Header + VideoMetaPreview + ProgressIndicator("댓글 모으는 중") + 취소 |
| `analyzing` | Header + VideoMetaPreview + ProgressIndicator("AI 분석 중") + 취소 |
| `result` | Header + UrlInput + Dashboard + 면책 + 재분석 버튼 |
| `empty` | Header + UrlInput + EmptyState |
| `error` | Header + UrlInput + ErrorBanner + 복구 동선 |
| Toast / OfflineBanner | overlay |
| ErrorBoundary fallback | 모든 컴포넌트 위 (catastrophic) — 기본 CTA "새로고침", 보조 "이슈 보고" |
