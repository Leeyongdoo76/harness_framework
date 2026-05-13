# Step 6: reducer-and-orchestrator

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 상태 머신, 데이터 흐름, 비동기 취소
- `/docs/PRD.md` — 사용자 플로우 B~H, 동시성 케이스
- `/docs/ADR.md` — ADR-011 (AbortController), ADR-022 (에러 복귀 + 중첩 방지 + KEYS_SAVED 자동 복귀), ADR-024 (메타 캐시)

step 1 산출물:
- `src/types/appState.ts`, `src/types/errors.ts`, `src/types/report.ts`, `src/types/videoMeta.ts`

step 2 산출물:
- `src/lib/cache.ts`, `src/lib/metaCache.ts`, `src/lib/retry.ts`

step 4 산출물:
- `src/services/youtube.ts`

step 5 산출물:
- `src/services/claude.ts`

## 작업

reducer와 orchestrator 두 모듈을 lib에 만든다.

### 1. `src/lib/reducer.ts`

```ts
import type { AppState, Action } from "@/types/appState";

export function initialState(opts: { hasKeys: boolean; hashVideoId?: string }): AppState;
export function reducer(state: AppState, action: Action): AppState;
```

#### `initialState`

- `hasKeys === false` → `{ kind: "needs_keys" }`
- `hasKeys === true` → `{ kind: "idle" }` (hash 처리는 App의 첫 effect에서 `HASH_VIDEO_ID` dispatch로)

#### `reducer` 핵심 규칙

ARCHITECTURE "상태 머신" 전이를 그대로 구현하되:

1. **error 중첩 방지** (ADR-022):
   ```ts
   case "FAILED": {
     if (state.kind === "error") return { ...state, error: action.error };  // previous 유지
     return { kind: "error", error: action.error, previous: state };
   }
   ```
   단 `action.error instanceof AbortError` → state 변경 없이 그대로 반환 (의도된 취소는 무시).

2. **KEYS_SAVED 자동 복귀** (ADR-022):
   ```ts
   case "KEYS_SAVED": {
     if (state.kind === "needs_keys") return { kind: "idle" };
     if (state.kind === "error" && isAuthError(state.error)) return state.previous;
     return state;
   }
   ```
   `isAuthError`는 `types/errors.ts` import.

3. **KEYS_CLEARED**: 어느 상태든 → `{ kind: "needs_keys" }`.

4. **URL_CHANGED**: 형식 검증은 reducer 밖. 단순 url 갱신:
   - state.kind가 `idle` → `{ kind: "idle", url: action.url }`
   - state.kind가 `metaLoading` / `metaReady` / `result` / `empty` / `error` → `{ kind: "idle", url: action.url }`로 reset
   - state.kind가 `validating` / `fetching` / `analyzing` → state 유지 (분석 중에는 URL 변경 무시. App이 controller.abort()로 취소시키고 새 액션 dispatch)

5. **META_FETCH_REQUESTED**: 어느 상태든 → `{ kind: "metaLoading", url, videoId, controller }`. App이 dispatch 전 이전 controller.abort() 처리.

6. **META_RESULT**: `state.kind === "metaLoading"`일 때만 → `{ kind: "metaReady", videoId, videoMeta, metaError }`. 다른 상태면 state 유지 (stale).

7. **ANALYZE_REQUESTED**: `state.kind === "metaReady"`일 때 → `{ kind: "validating", videoId, videoMeta, force: false }`. 다른 상태면 무시.

8. **CACHE_HIT** (validating에서 즉시 결과): → `{ kind: "result", videoId, videoMeta, report, commentCount, fromCache: true, cachedAt, truncatedCount }`.

9. **FETCH_STARTED**: validating → `{ kind: "fetching", videoId, videoMeta, controller }`.

10. **ANALYZE_STARTED**: fetching → `{ kind: "analyzing", videoId, videoMeta, comments, controller }`.

11. **RESULT_READY**: analyzing → `{ kind: "result", videoId, videoMeta, report, commentCount: state.comments.length, fromCache: false, truncatedCount }`.

12. **EMPTY**: fetching → `{ kind: "empty", videoId, videoMeta, reason }`.

13. **CANCELLED**: metaLoading / fetching / analyzing → `{ kind: "idle", url: undefined }`. controller.abort()는 App에서.

14. **RESET_ERROR**: error → state.previous.

15. **REANALYZE**: result → `{ kind: "validating", videoId, videoMeta, force: true }`. force 플래그가 state에 들어가므로 useEffect가 같은 validating 흐름에서 force 값을 읽어 orchestrator에 전달 (useRef 우회 불필요).

16. **HASH_VIDEO_ID**: 어느 상태든 → `{ kind: "metaLoading", url: \`https://www.youtube.com/watch?v=\${videoId}\`, videoId, controller }`.

#### 매트릭스 테스트

`src/lib/reducer.test.ts`에서:
- 핵심 시나리오 (PRD A~H 끝까지)
- 각 액션의 무효 상태(예: RESULT_READY를 idle에서)는 state 유지 검증
- error 중첩: error → FAILED → error 상태에서 previous가 새 error로 안 바뀜
- KEYS_SAVED → error.previous 복귀 검증
- AbortError dispatch는 무시

### 2. `src/lib/analyze.ts`

orchestrator. services + cache 묶음.

```ts
import type { Comment } from "@/types/youtube";
import type { VideoMeta } from "@/types/videoMeta";
import type { Report } from "@/types/report";

export type AnalyzeOptions = {
  videoId: string;
  videoMeta?: VideoMeta;
  ytKey: string;
  anthKey: string;
  force?: boolean;
  signal?: AbortSignal;
  onFetchStarted?: (controller: AbortController) => void;
  onAnalyzeStarted?: (comments: Comment[], controller: AbortController) => void;
};

export type AnalyzeResult =
  | { kind: "cached"; report: Report; videoMeta?: VideoMeta; cachedAt: string; commentCount: number; truncatedCount?: number }
  | { kind: "fresh"; report: Report; videoMeta?: VideoMeta; commentCount: number; truncatedCount?: number }
  | { kind: "empty"; reason: "commentsDisabled" | "noComments" };

export async function getOrAnalyze(opts: AnalyzeOptions): Promise<AnalyzeResult>;
```

흐름:
1. `opts.force !== true`면 `getReport(videoId)` → hit 시 `{ kind: "cached", report, videoMeta: cached.videoMeta, cachedAt: cached.createdAt, commentCount: cached.commentCount, truncatedCount: cached.truncatedCount }` 반환
2. miss/force:
   - **fetching 단계**: 새 AbortController 생성 → `opts.onFetchStarted?.(controller)` 호출 → `fetchTopComments(videoId, ytKey, controller.signal)` 호출
     - `CommentsDisabledError` catch → `{ kind: "empty", reason: "commentsDisabled" }`
     - 빈 배열 → `{ kind: "empty", reason: "noComments" }`
   - **analyzing 단계**: 새 AbortController 생성 → `opts.onAnalyzeStarted?.(comments, controller)` → `analyzeComments(comments, anthKey, controller.signal)` 호출
3. `setReport(videoId, { report, videoMeta, commentCount: comments.length, truncatedCount })` 저장 (실패는 catch로 silent — `StorageError`는 throw하되 호출자가 toast 띄움)
4. `{ kind: "fresh", report, videoMeta, commentCount, truncatedCount }` 반환

`opts.signal` (외부 cancel): 시작 시 점검, 단계 사이 점검. signal.aborted면 `AbortError` throw.

**주의**: controller를 내부에서 만들어 콜백에 넘기는 이유 — reducer가 각 단계별 controller를 받아 다음 전이에 abort 가능하게 함. App은 이 controller를 reducer 액션에 첨부해 dispatch.

테스트: mock services (`vi.mock("@/services/youtube")`, `vi.mock("@/services/claude")`)로 5가지 흐름:
- cached / fresh / empty:commentsDisabled / empty:noComments / 도메인 에러 전파

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/lib/reducer.ts`, `src/lib/analyze.ts` + 테스트
   - [ ] reducer 매트릭스 테스트가 핵심 (state, action) 조합 검증
   - [ ] error → FAILED 시 previous가 보존 (테스트 통과)
   - [ ] auth 에러 + KEYS_SAVED → previous 자동 복귀 (테스트 통과)
   - [ ] AbortError dispatch는 상태 변경 없음
   - [ ] orchestrator의 force 옵션이 캐시 건너뜀
   - [ ] orchestrator가 콜백을 정확한 시점에 호출
3. index.json 업데이트:
   - 성공 → `"summary": "reducer (상태 머신 + error 중첩 방지 + KEYS_SAVED 자동 복귀) + orchestrator (캐시 → fetch → analyze → 저장). 매트릭스 + 흐름 테스트 통과."`

## 금지사항

- **state 직접 mutate 금지** (`state.kind = "idle"` 등). 항상 새 객체. 이유: useReducer 계약.
- **reducer 안에서 비동기 작업 금지** (fetch/setTimeout 등). 부수효과는 App의 useEffect. 이유: reducer 순수성.
- **AbortError를 사용자에 표시 금지.** reducer에서 즉시 무시. 이유: ADR-011.
- **orchestrator에서 React import 금지.** lib/services만. 이유: 단일 책임.
- **error 전이 시 previous에 또 다른 error 넣지 마라.** 기존 previous 유지. 이유: ADR-022.
