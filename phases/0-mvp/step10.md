# Step 10: app-integration

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/PRD.md` — 모든 사용자 플로우 A~H, 동시성 케이스
- `/docs/ARCHITECTURE.md` — 상태 ↔ 컴포넌트 매핑, 데이터 흐름, 비동기 취소
- `/docs/ADR.md` — 거의 전부 (특히 ADR-022, ADR-025, ADR-026, ADR-027)

step 1~9 모든 산출물.

## 작업

`src/App.tsx`와 `src/main.tsx`에 모든 piece를 통합한다.

### 1. `src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
```

ADR-017 준수 (non-null assertion `!` 금지 — 명시적 가드 사용).

### 2. `src/App.tsx`

#### 시그니처
```tsx
export default function App(): JSX.Element;
```

#### Hook 구독
```ts
const { keys, save: saveKeysFn, clear: clearKeysFn } = useApiKeys();
const { videoId: hashVideoId, setVideoId: setHashVideoId } = useUrlHash();
const isOnline = useOnlineStatus();
const [state, dispatch] = useReducer(reducer, undefined, () =>
  initialState({ hasKeys: keys !== null, hashVideoId: hashVideoId ?? undefined })
);
const [settingsOpen, setSettingsOpen] = useState(false);
const [toastKey, setToastKey] = useState<CopyKey | null>(null);
```

#### Effect 1: 첫 진입 hash 처리 (마운트 1회)
```ts
useEffect(() => {
  if (keys && hashVideoId && state.kind === "idle") {
    const controller = new AbortController();
    dispatch({ type: "HASH_VIDEO_ID", videoId: hashVideoId, controller });
  }
  // localStorage fallback toast
  if (isUsingFallback()) setToastKey("toast.storageFallback");
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

#### Effect 2: metaLoading 상태에서 메타 조회 실행
```ts
useEffect(() => {
  if (state.kind !== "metaLoading") return;
  let cancelled = false;
  const { videoId, controller } = state;

  (async () => {
    try {
      const cached = getMeta(videoId);
      if (cached) {
        if (!cancelled) dispatch({ type: "META_RESULT", videoMeta: cached });
        return;
      }
      const meta = await fetchVideoMeta(videoId, keys!.youtube, controller.signal);
      setMeta(videoId, meta);
      if (!cancelled) dispatch({ type: "META_RESULT", videoMeta: meta });
    } catch (e) {
      if (cancelled || e instanceof AbortError) return;
      if (e instanceof YouTubeAuthError || e instanceof YouTubeNotFoundError) {
        dispatch({ type: "FAILED", error: e });
      } else {
        dispatch({ type: "META_RESULT", metaError: e as AppError });
      }
    }
  })();

  return () => {
    cancelled = true;
    controller.abort();
  };
}, [state.kind === "metaLoading" ? state.videoId : null]);  // eslint-disable-line react-hooks/exhaustive-deps
```

**의존성 배열 규칙** (Effect 2와 Effect 3 공통):
- `state` 객체를 직접 의존성에 넣으면 매 dispatch마다 재실행 → 무한 루프 위험.
- 안정 키 패턴: `state.kind === "X" ? state.videoId : null` — 같은 videoId면 같은 키.
- 이 패턴은 ESLint `react-hooks/exhaustive-deps` 위반이므로 **줄 끝에 `// eslint-disable-line react-hooks/exhaustive-deps` 명시 필수** (`--max-warnings 0` 통과를 위해).
- effect 안 첫 줄에서 `if (state.kind !== "X") return;` 가드로 안전 보장.

#### Effect 3: validating 상태에서 orchestrator 실행
```ts
useEffect(() => {
  if (state.kind !== "validating") return;
  let cancelled = false;
  const { videoId, videoMeta } = state;

  (async () => {
    try {
      const result = await getOrAnalyze({
        videoId,
        videoMeta,
        ytKey: keys!.youtube,
        anthKey: keys!.anthropic,
        force: state.force ?? false,  // AppState.validating.force 사용 (REANALYZE 시 true)
        onFetchStarted: (controller) => {
          if (cancelled) return;
          dispatch({ type: "FETCH_STARTED", controller });
        },
        onAnalyzeStarted: (comments, controller) => {
          if (cancelled) return;
          dispatch({ type: "ANALYZE_STARTED", comments, controller });
        },
      });
      if (cancelled) return;
      if (result.kind === "cached") {
        dispatch({
          type: "CACHE_HIT",
          report: result.report,
          commentCount: result.commentCount,
          cachedAt: result.cachedAt,
          truncatedCount: result.truncatedCount,
        });
      } else if (result.kind === "fresh") {
        dispatch({
          type: "RESULT_READY",
          report: result.report,
          truncatedCount: result.truncatedCount,
        });
      } else {
        dispatch({ type: "EMPTY", reason: result.reason });
      }
    } catch (e) {
      if (cancelled || e instanceof AbortError) return;
      if (e instanceof StorageError) setToastKey("toast.cacheSaveFailed");
      else dispatch({ type: "FAILED", error: e as AppError });
    }
  })();

  return () => {
    cancelled = true;
  };
}, [state.kind === "validating" ? state.videoId : null]);  // eslint-disable-line react-hooks/exhaustive-deps
```

#### Effect 4: REANALYZE → Effect 3이 그대로 처리

REANALYZE 액션은 reducer가 `{ kind: "validating", videoId, videoMeta, force: true }` 상태로 전이시킨다 (step 1 `AppState.validating.force`, step 6 reducer). Effect 3은 `state.kind === "validating"`일 때 실행되고 `state.force` 값을 그대로 orchestrator의 `force` 옵션에 전달한다. **별도 effect나 useRef 불필요.**

Dashboard의 onReanalyze 핸들러:
```ts
const onReanalyze = () => dispatch({ type: "REANALYZE" });
```

hash는 이미 갱신돼 있으므로 추가 작업 없음.

#### Effect 5: ANALYZE_REQUESTED 직후 URL hash 갱신 (ADR-026)

reducer 액션 자체는 부수효과를 모르므로, `dispatch({ type: "ANALYZE_REQUESTED" })`를 호출하는 코드(VideoMetaPreview onAnalyze 핸들러)에서 같은 흐름으로 `setHashVideoId(videoId)` 호출:

```ts
const handleAnalyze = () => {
  if (state.kind !== "metaReady") return;
  setHashVideoId(state.videoId);    // hash 먼저 갱신
  dispatch({ type: "ANALYZE_REQUESTED" });
};
```

REANALYZE도 동일 (hash는 이미 있으니 setHashVideoId 생략 가능).

URL 변경 / KEYS_CLEARED 시 hash 제거:
```ts
useEffect(() => {
  if (state.kind === "needs_keys" || state.kind === "idle") {
    setHashVideoId(null);
  }
}, [state.kind]);
```

#### Effect 6: page title 동기화
```ts
const title = useMemo(() => {
  if (state.kind === "fetching" || state.kind === "analyzing" || state.kind === "validating") {
    return t("meta.titleAnalyzing");
  }
  if (state.kind === "result") {
    return t("meta.titleResult", { videoTitle: state.videoMeta?.title ?? state.videoId });
  }
  return t("meta.titleDefault");
}, [state]);
useDocumentTitle(title);
```

#### Effect 7: 인증 에러 시 키 모달 자동 오픈
```ts
useEffect(() => {
  if (state.kind === "error" && isAuthError(state.error)) {
    setSettingsOpen(true);
  }
}, [state]);
```

#### Effect 8: 오프라인 진입 시 진행 중 분석 abort
```ts
useEffect(() => {
  if (!isOnline) {
    if (state.kind === "metaLoading" || state.kind === "fetching" || state.kind === "analyzing") {
      // controller는 state에 있음
      ("controller" in state ? state.controller : null)?.abort();
      dispatch({ type: "FAILED", error: new OfflineError() });
    }
  }
}, [isOnline]);
```

**필수 import** (App.tsx 상단에 다음을 넣어야 모든 effect/렌더가 컴파일됨):
```ts
import { useEffect, useMemo, useReducer, useState } from "react";
import { useApiKeys } from "@/lib/keys";
import { useUrlHash } from "@/lib/urlHash";
import { useOnlineStatus } from "@/lib/online";
import { useDocumentTitle } from "@/lib/pageTitle";
import { reducer, initialState } from "@/lib/reducer";
import { getOrAnalyze } from "@/lib/analyze";
import { getMeta, setMeta } from "@/lib/metaCache";
import { isUsingFallback } from "@/lib/storage";
import { clearAll } from "@/lib/clearAll";
import { t } from "@/lib/copy";
import { fetchVideoMeta } from "@/services/youtube";
import {
  AbortError, OfflineError, StorageError,
  YouTubeAuthError, YouTubeNotFoundError,
  isAuthError, type AppError,
} from "@/types/errors";
import type { CopyKey } from "@/types/copy";
// 컴포넌트 import는 별도 (Header, Footer, ApiKeyModal, ..., Dashboard 등)
```

#### aria-live 메시지 결정
```ts
const politeMessage = useMemo(() => {
  if (state.kind === "fetching") return t("status.fetchingStarted");
  if (state.kind === "analyzing") return t("status.analyzingStarted");
  if (state.kind === "result") return t("status.analysisComplete");
  if (state.kind === "idle" && /* 직전이 fetching/analyzing이었으면 cancelled */) return t("status.cancelled");
  return "";
}, [state.kind]);

const assertiveMessage = state.kind === "error" ? state.error.userMessage : "";
```

#### 렌더 (상태 분기, ARCHITECTURE "상태 ↔ 컴포넌트 매핑")
```tsx
return (
  <div className="min-h-screen bg-[#0a0a0a] text-neutral-300">
    <OfflineBanner />
    <AriaLive politeMessage={politeMessage} assertiveMessage={assertiveMessage} />
    <Header onOpenSettings={() => setSettingsOpen(true)} />

    <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {state.kind === "idle" && (
        <p className="text-neutral-400">{t("welcome.intro")}</p>
      )}

      {/* UrlInput — needs_keys 제외 모든 상태에서 표시 */}
      {state.kind !== "needs_keys" && (
        <UrlInput
          value={"url" in state ? state.url ?? "" : ""}
          onChange={(url) => dispatch({ type: "URL_CHANGED", url })}
          onSubmit={(videoId) => {
            const controller = new AbortController();
            dispatch({ type: "META_FETCH_REQUESTED", videoId, controller });
          }}
          disabled={state.kind === "fetching" || state.kind === "analyzing"}
        />
      )}

      {state.kind === "metaLoading" && <VideoMetaPreview kind="loading" />}
      {state.kind === "metaReady" && (
        state.videoMeta
          ? <VideoMetaPreview kind="ready" meta={state.videoMeta} onAnalyze={handleAnalyze} />
          : <VideoMetaPreview kind="fallback" videoId={state.videoId} errorMessage={t("meta.metaLoadError")} onAnalyze={handleAnalyze} />
      )}

      {(state.kind === "fetching" || state.kind === "analyzing") && (
        <ProgressIndicator
          phase={state.kind === "fetching" ? "fetching" : "analyzing"}
          onCancel={() => {
            ("controller" in state ? state.controller : null)?.abort();
            dispatch({ type: "CANCELLED" });
          }}
        />
      )}

      {state.kind === "empty" && <EmptyState reason={state.reason} />}

      {state.kind === "result" && (
        <Dashboard
          videoId={state.videoId}
          videoMeta={state.videoMeta}
          report={state.report}
          commentCount={state.commentCount}
          fromCache={state.fromCache}
          cachedAt={state.cachedAt}
          truncatedCount={state.truncatedCount}
          onReanalyze={() => {
            forceRef.current = true;
            dispatch({ type: "REANALYZE" });
          }}
        />
      )}

      {state.kind === "error" && (
        <ErrorBanner
          error={state.error}
          actions={determineActions(state.error)}
          onAction={(action) => {
            if (action === "retry") dispatch({ type: "RESET_ERROR" });
            else if (action === "openSettings") setSettingsOpen(true);
            else if (action === "refreshPage") window.location.reload();
            else if (action === "editUrl") dispatch({ type: "URL_CHANGED", url: "" });
          }}
        />
      )}
    </main>

    {(state.kind === "needs_keys" || settingsOpen) && (
      <ApiKeyModal
        mode={state.kind === "needs_keys" ? "first" : "edit"}
        currentKeys={keys ?? undefined}
        onSave={(newKeys) => {
          saveKeysFn(newKeys);
          setSettingsOpen(false);
          dispatch({ type: "KEYS_SAVED" });
        }}
        onClose={() => setSettingsOpen(false)}
        onClearAll={() => {
          clearAll();
          clearKeysFn();
          setSettingsOpen(false);
          dispatch({ type: "KEYS_CLEARED" });
        }}
      />
    )}

    <Toast messageKey={toastKey} onDismiss={() => setToastKey(null)} />
    <Footer />
  </div>
);
```

`determineActions(error)`: 도메인 에러 code에 따라 ErrorBannerAction 배열 반환:
- AI_AUTH, YT_AUTH → ["openSettings"]
- INVALID_URL, YT_NOT_FOUND, YT_BAD_REQUEST → ["editUrl"]
- 재시도 가능 → ["retry"]
- 그 외 → ["retry", "refreshPage"]

### 통합 테스트 (RTL)

`src/App.test.tsx`:
1. 키 없음 → 모달 표시
2. 키 입력 + 저장 → 모달 닫힘, idle 진입
3. URL 입력 + blur → 메타 호출 mock → VideoMetaPreview 표시
4. 분석 시작 → fetch mock → analyze mock → 결과 6개 카드
5. 분석 중 취소 → idle 복귀
6. 오프라인 이벤트 → 배너 + abort
7. 결과 후 재분석 → force 호출

서비스 모킹: `vi.mock("@/services/youtube")`, `vi.mock("@/services/claude")`.

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

추가 수동 (AC 비포함):
```bash
npm run dev    # 본인 키 입력 후 동작 확인
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/App.tsx`, `src/main.tsx` 업데이트
   - [ ] `main.tsx`에서 ErrorBoundary 래핑됨
   - [ ] `!` non-null assertion 사용 없음 (`getElementById("root")` 명시 가드)
   - [ ] AbortController가 effect cleanup에서 abort()
   - [ ] hash 갱신이 ANALYZE_REQUESTED 직전 (setHashVideoId 호출 후 dispatch)
   - [ ] page title이 상태에 따라 갱신
   - [ ] 인증 에러 시 설정 모달 자동 오픈
   - [ ] 오프라인 진입 시 분석 abort + FAILED dispatch
   - [ ] aria-live 영역 메시지 갱신
   - [ ] 모든 상태별 컴포넌트 렌더
   - [ ] RTL 통합 테스트 7종 통과
3. index.json 업데이트:
   - 성공 → `"summary": "App 통합 완료. reducer + 5 hook + 모든 컴포넌트 + AbortController + hash + title + aria-live + 오프라인 abort. RTL 통합 7종 PASS."`

## 금지사항

- **`!` non-null assertion 금지** (`document.getElementById("root")!` 포함). 명시적 가드. 이유: ADR-017.
- **`history.pushState` 금지.** `setHashVideoId`(replaceState)만. 이유: ADR-026.
- **useEffect 의존성 배열에 객체 직접 넣지 마라** (재참조 무한 루프). 안정 키 사용. 이유: 안정성.
- **effect cleanup에서 abort 누락 금지.** 이유: race condition.
- **components/services 신규 생성 금지.** 이 step은 통합만. 이유: 자기완결성.
- **mock 데이터/dev 분기를 production 코드에 박지 마라.** 이유: 코드 청결성.
- **카피 임의 작성 금지.** 모두 `t()`. 이유: ADR-028.
