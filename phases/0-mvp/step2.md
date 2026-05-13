# Step 2: lib-pure

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — lib/ 섹션, 캐시 정책, 저장소 추상화, 재시도, PII
- `/docs/PRD.md` — 카피 표 전체 (`lib/copy.ts`에 1:1 옮김)
- `/docs/ADR.md` — ADR-005 (캐시), ADR-009 (재시도), ADR-010 (truncation), ADR-012 (storage fallback), ADR-023 (prefix), ADR-024 (메타 캐시), ADR-028 (카피 SSOT), ADR-029 (PII)

step 1 산출물 (import 필수):
- `src/types/report.ts`, `src/types/videoMeta.ts`, `src/types/errors.ts`, `src/types/copy.ts`

## 작업

`src/lib/` 안에 React 의존 없는 순수 함수 + 데이터 레이어를 만든다. **이 step 어느 파일도 React를 import하지 않는다.** 브라우저 API(localStorage 등)는 OK.

### 1. `src/lib/videoId.ts`

```ts
export function parseVideoId(url: string): string | null;
```

지원 형식 (PRD 핵심기능 2):
- `youtube.com/watch?v=ID` (http/https, www/m. 무관)
- `youtu.be/ID`
- `youtube.com/shorts/ID`
- `youtube.com/embed/ID`
- `youtube.com/v/ID`
- `youtube.com/live/ID`
- `m.youtube.com/*`

videoId 정규식: `/^[A-Za-z0-9_-]{11}$/`. 부가 파라미터(`?t=`, `?list=`, `&si=`) 무시.

거부 → `null` 반환:
- 플레이리스트 (`/playlist?list=`, path `/playlist`)
- 채널 (`/channel/`, `/@`, `/user/`, `/c/`)
- 빈 문자열, 2000자 초과, 유튜브 도메인 아님

테스트: 케이스 매트릭스(15+).

### 2. `src/lib/storage.ts`

```ts
export interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

export function getStore(): KVStore;
export function isUsingFallback(): boolean;
```

모듈 레벨에서 1회 결정 (lazy):
- `localStorage.setItem("__probe__", "1")` + `removeItem("__probe__")` 시도
- 성공 → localStorage 어댑터
- `SecurityError`/`DOMException` (Safari private 등) → 인메모리 `Map` 어댑터 + fallback 플래그 + `console.warn` 1회

테스트: localStorage mock 정상 + SecurityError fallback.

### 3. `src/lib/cache.ts`

```ts
import type { Report } from "@/types/report";
import type { VideoMeta } from "@/types/videoMeta";

export type CachedEntry = {
  schemaVersion: 1;
  createdAt: string;
  videoMeta?: VideoMeta;
  report: Report;
  commentCount: number;
  truncatedCount?: number;
};

export function getReport(videoId: string): CachedEntry | null;
export function setReport(videoId: string, entry: Omit<CachedEntry, "schemaVersion" | "createdAt"> & { createdAt?: string }): void;
```

규칙 (ADR-005, ADR-023):
- 키: `report:{videoId}`
- TTL 30일: `Date.now() - new Date(createdAt).getTime() > 30 * 86400e3` → 삭제 후 null
- `schemaVersion !== 1` → 삭제 후 null
- `JSON.parse` 예외 → 삭제 후 null
- `setReport` quota 초과 → `getStore().keys()`에서 `report:` prefix 중 `createdAt` 최소 1개 제거 후 1회 재시도. 또 실패 → `StorageError` throw.

테스트: TTL, 스키마 mismatch, 손상, quota fallback, LRU.

### 4. `src/lib/metaCache.ts`

```ts
import type { VideoMeta } from "@/types/videoMeta";

export type CachedMeta = {
  schemaVersion: 1;
  fetchedAt: string;
  videoMeta: VideoMeta;
};

export function getMeta(videoId: string): VideoMeta | null;
export function setMeta(videoId: string, videoMeta: VideoMeta): void;
```

규칙 (ADR-024):
- 키: `videometa:{videoId}`
- TTL 1시간 (3600 * 1000 ms)
- 무효화 정책 동일
- quota 초과 시 silent skip (cache.ts와 달리 토스트 안 띄움 — 사소)

### 5. `src/lib/retry.ts`

```ts
export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry: (e: unknown) => boolean;
  signal?: AbortSignal;
};

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T>;
```

- 백오프: `baseDelayMs * 2 ** (attempt - 1)`
- `signal.aborted` → `AbortError` throw, sleep 중에도 깨움 (`signal.addEventListener("abort", ...)`)
- `shouldRetry` false → 즉시 throw

테스트: 1회 성공, 2회 실패→3회 성공, signal abort 중간, shouldRetry false 즉시 throw.

### 6. `src/lib/copy.ts`

PRD 카피 표 전체를 객체로:

```ts
import type { CopyKey } from "@/types/copy";

const copy: Record<CopyKey, string> = {
  "welcome.intro": "YouTube 영상 URL을 붙여넣으면 댓글을 자동으로 분석해드립니다.",
  "header.title": "YouTube 댓글 분석",
  // ... 모든 키. PRD 카피 표 1:1 복사
};

export function t(key: CopyKey, params?: Record<string, string | number>): string {
  const template = copy[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}
```

**규칙**: PRD 카피 표 모든 행을 빠짐없이. `Record<CopyKey, string>`이므로 누락 시 컴파일 에러. 본문은 PRD와 1:1.

테스트: 모든 키 lookup, 파라미터 치환, 누락 파라미터 처리.

### 7. `src/lib/relativeTime.ts`

```ts
export function toRelativeKorean(iso: string, now?: Date): string;
```

(PRD `relTime.*` 카피)
- < 1분 → `t("relTime.justNow")`
- < 60분 → `t("relTime.minutesAgo", { n })`
- < 24시간 → `t("relTime.hoursAgo", { n })`
- < 7일 → `t("relTime.daysAgo", { n })`
- < 30일 → `t("relTime.weeksAgo", { n })`
- ≥ 30일 → `t("relTime.over30Days")`

`now` 기본값 `new Date()`. 테스트는 주입.

테스트: 경계 케이스 (30초, 59분, 1시간, 6일, 30일).

### 8. `src/lib/pii.ts`

```ts
import type { Report } from "@/types/report";

export function maskPII(text: string): string;
export function maskPIIInReport(report: Report): Report;
```

정규식:
- 전화: `/(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g` → `***-****-****`
- 이메일: `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g` → `***@***`

`maskPIIInReport` 적용 대상:
- `summary`
- `strengths[].point`, `strengths[].evidence[]`
- `improvements[].point`, `improvements[].evidence[]`
- `notableComments[].text`

`keywords[].term`, `notableComments[].author`는 마스킹 안 함 (입력 그대로의 정보).

테스트: 전화/이메일 케이스, 마스킹 후 정상 문자열 보존.

### 9. `src/lib/clearAll.ts`

```ts
export function clearAll(): void;
```

`getStore().keys()`에서 4 prefix(`keys:`, `report:`, `videometa:`, `flag:`)로 시작하는 키 모두 제거 (ADR-023).

테스트: 4 prefix + 다른 prefix(`other:foo`) 혼합 → 4 prefix만 제거.

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/lib/` 9개 파일 모두 존재
   - [ ] 어떤 파일도 React/services import 없음
   - [ ] `lib/copy.ts`가 PRD 카피 표 모든 키 (`Record<CopyKey, string>` 컴파일 통과)
   - [ ] `storage.ts` SecurityError fallback 동작
   - [ ] `cache.ts` TTL/스키마/손상 모두 null 반환
3. index.json 업데이트:
   - 성공 → `"summary": "lib 순수 9종: videoId, cache(30d), metaCache(1h), storage(fallback), retry(백오프+signal), copy(PRD SSOT), relativeTime, pii(전화/이메일), clearAll(4 prefix)."`

## 금지사항

- **React import 금지.** hook은 step 3. 이유: 순수성.
- **services/ import 금지.** 이유: 의존 방향.
- **`any`/`!` 금지.** 이유: ADR-017.
- **PRD 카피 표에 없는 키를 `copy.ts`에 임의 추가 금지.** 새 키는 PRD 먼저. 이유: ADR-028.
- **localStorage prefix를 4종 외 추가 금지.** 이유: ADR-023 (clearAll 안전성).
