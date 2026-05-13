import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import AriaLive from "@/components/AriaLive";
import ApiKeyModal from "@/components/ApiKeyModal";
import Dashboard from "@/components/Dashboard";
import EmptyState from "@/components/EmptyState";
import ErrorBanner, { type ErrorBannerAction } from "@/components/ErrorBanner";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OfflineBanner from "@/components/OfflineBanner";
import ProgressIndicator from "@/components/ProgressIndicator";
import Toast from "@/components/Toast";
import UrlInput from "@/components/UrlInput";
import VideoMetaPreview from "@/components/VideoMetaPreview";
import { getOrAnalyze, type AnalyzeOptions } from "@/lib/analyze";
import { clearAll } from "@/lib/clearAll";
import { t } from "@/lib/copy";
import { useApiKeys } from "@/lib/keys";
import { getMeta, setMeta } from "@/lib/metaCache";
import { useOnlineStatus } from "@/lib/online";
import { useDocumentTitle } from "@/lib/pageTitle";
import { initialState, reducer } from "@/lib/reducer";
import { isUsingFallback } from "@/lib/storage";
import { useUrlHash } from "@/lib/urlHash";
import { fetchVideoMeta } from "@/services/youtube";
import type { Action, AppState } from "@/types/appState";
import type { CopyKey } from "@/types/copy";
import {
  AbortError,
  isAuthError,
  OfflineError,
  StorageError,
  YouTubeAuthError,
  YouTubeNotFoundError,
  type AppError,
} from "@/types/errors";

function deriveUrl(state: AppState): string {
  if (state.kind === "idle") return state.url ?? "";
  if (state.kind === "metaLoading") return state.url;
  if (state.kind === "error") return deriveUrl(state.previous);
  if (state.kind === "needs_keys") return "";
  return `https://www.youtube.com/watch?v=${state.videoId}`;
}

function determineActions(error: AppError): ErrorBannerAction[] {
  switch (error.code) {
    case "AI_AUTH":
    case "YT_AUTH":
      return ["openSettings"];
    case "INVALID_URL":
    case "YT_NOT_FOUND":
    case "YT_BAD_REQUEST":
      return ["editUrl"];
  }
  if (error.retriable) return ["retry"];
  return ["retry", "refreshPage"];
}

export default function App(): JSX.Element {
  const { keys, save: saveKeysFn, clear: clearKeysFn } = useApiKeys();
  const { videoId: hashVideoId, setVideoId: setHashVideoId } = useUrlHash();
  const isOnline = useOnlineStatus();
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState({
      hasKeys: keys !== null,
      ...(hashVideoId !== null ? { hashVideoId } : {}),
    }),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastKey, setToastKey] = useState<CopyKey | null>(null);

  const validatingRunIdRef = useRef(0);
  const prevKindRef = useRef<AppState["kind"]>(state.kind);
  const didBootstrapRef = useRef(false);

  // Effect 1: first-mount hash hydration + storage fallback toast (mount once).
  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;
    if (keys !== null && hashVideoId !== null && state.kind === "idle") {
      const controller = new AbortController();
      dispatch({ type: "HASH_VIDEO_ID", videoId: hashVideoId, controller });
    }
    if (isUsingFallback()) {
      setToastKey("toast.storageFallback");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2: metaLoading → fetchVideoMeta (cache-first).
  useEffect(() => {
    if (state.kind !== "metaLoading") return;
    if (keys === null) return;
    const { videoId, controller } = state;
    const ytKey = keys.youtube;

    void (async () => {
      try {
        const cached = getMeta(videoId);
        if (cached !== null) {
          if (!controller.signal.aborted) {
            dispatch({ type: "META_RESULT", videoMeta: cached });
          }
          return;
        }
        const meta = await fetchVideoMeta(videoId, ytKey, controller.signal);
        setMeta(videoId, meta);
        if (!controller.signal.aborted) {
          dispatch({ type: "META_RESULT", videoMeta: meta });
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof AbortError) return;
        if (e instanceof YouTubeAuthError || e instanceof YouTubeNotFoundError) {
          dispatch({ type: "FAILED", error: e });
          return;
        }
        dispatch({ type: "META_RESULT", metaError: e as AppError });
      }
    })();

    return () => {
      controller.abort();
    };
    // Stable key pattern: re-run only when videoId in metaLoading changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === "metaLoading" ? state.videoId : null]);

  // Effect 3: validating → orchestrator (cache or fresh).
  // runIdRef guards against stale dispatches when a newer validating starts.
  useEffect(() => {
    if (state.kind !== "validating") return;
    if (keys === null) return;
    const myRun = ++validatingRunIdRef.current;
    const { videoId } = state;
    const force = state.force ?? false;
    const ytKey = keys.youtube;
    const anthKey = keys.anthropic;
    const capturedMeta = state.videoMeta;

    void (async () => {
      try {
        const opts: AnalyzeOptions = {
          videoId,
          ytKey,
          anthKey,
          force,
          onFetchStarted: (innerController) => {
            if (validatingRunIdRef.current !== myRun) return;
            dispatch({ type: "FETCH_STARTED", controller: innerController });
          },
          onAnalyzeStarted: (comments, innerController) => {
            if (validatingRunIdRef.current !== myRun) return;
            dispatch({
              type: "ANALYZE_STARTED",
              comments,
              controller: innerController,
            });
          },
        };
        if (capturedMeta !== undefined) opts.videoMeta = capturedMeta;

        const result = await getOrAnalyze(opts);
        if (validatingRunIdRef.current !== myRun) return;

        if (result.kind === "cached") {
          const action: Action = {
            type: "CACHE_HIT",
            report: result.report,
            commentCount: result.commentCount,
            cachedAt: result.cachedAt,
          };
          if (result.truncatedCount !== undefined) {
            action.truncatedCount = result.truncatedCount;
          }
          dispatch(action);
        } else if (result.kind === "fresh") {
          const action: Action = {
            type: "RESULT_READY",
            report: result.report,
          };
          if (result.truncatedCount !== undefined) {
            action.truncatedCount = result.truncatedCount;
          }
          dispatch(action);
        } else {
          dispatch({ type: "EMPTY", reason: result.reason });
        }
      } catch (e) {
        if (validatingRunIdRef.current !== myRun) return;
        if (e instanceof AbortError) return;
        if (e instanceof StorageError) {
          setToastKey("toast.cacheSaveFailed");
          return;
        }
        dispatch({ type: "FAILED", error: e as AppError });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === "validating" ? state.videoId : null]);

  // Effect 4: page title sync.
  const title = useMemo(() => {
    if (
      state.kind === "fetching" ||
      state.kind === "analyzing" ||
      state.kind === "validating"
    ) {
      return t("meta.titleAnalyzing");
    }
    if (state.kind === "result") {
      return t("meta.titleResult", {
        videoTitle: state.videoMeta?.title ?? state.videoId,
      });
    }
    return t("meta.titleDefault");
  }, [state]);
  useDocumentTitle(title);

  // Effect 5: auth-error → auto-open settings modal.
  useEffect(() => {
    if (state.kind === "error" && isAuthError(state.error)) {
      setSettingsOpen(true);
    }
  }, [state]);

  // Effect 6: offline → abort in-flight + dispatch OfflineError.
  useEffect(() => {
    if (isOnline) return;
    if (
      state.kind === "metaLoading" ||
      state.kind === "fetching" ||
      state.kind === "analyzing"
    ) {
      state.controller.abort();
      dispatch({ type: "FAILED", error: new OfflineError("offline") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // aria-live polite: progress + completion + cancellation.
  const politeMessage = ((): string => {
    if (state.kind === "fetching") return t("status.fetchingStarted");
    if (state.kind === "analyzing") return t("status.analyzingStarted");
    if (state.kind === "result") return t("status.analysisComplete");
    if (
      state.kind === "idle" &&
      (prevKindRef.current === "fetching" || prevKindRef.current === "analyzing")
    ) {
      return t("status.cancelled");
    }
    return "";
  })();
  useEffect(() => {
    prevKindRef.current = state.kind;
  }, [state.kind]);
  const assertiveMessage =
    state.kind === "error" ? state.error.userMessage : "";

  const handleUrlChange = (url: string): void => {
    dispatch({ type: "URL_CHANGED", url });
  };

  const handleUrlSubmit = (videoId: string): void => {
    // videoId de-dupe.
    if (
      (state.kind === "metaLoading" ||
        state.kind === "metaReady" ||
        state.kind === "validating" ||
        state.kind === "fetching" ||
        state.kind === "analyzing" ||
        state.kind === "result" ||
        state.kind === "empty") &&
      state.videoId === videoId
    ) {
      return;
    }
    const controller = new AbortController();
    dispatch({ type: "META_FETCH_REQUESTED", videoId, controller });
  };

  const handleAnalyze = (): void => {
    if (state.kind !== "metaReady") return;
    // Hash 갱신은 ANALYZE_REQUESTED 직전 (ADR-026).
    setHashVideoId(state.videoId);
    dispatch({ type: "ANALYZE_REQUESTED" });
  };

  const handleReanalyze = (): void => {
    dispatch({ type: "REANALYZE" });
  };

  const handleCancel = (): void => {
    if (
      state.kind === "metaLoading" ||
      state.kind === "fetching" ||
      state.kind === "analyzing"
    ) {
      state.controller.abort();
      dispatch({ type: "CANCELLED" });
    }
  };

  const handleErrorAction = (action: ErrorBannerAction): void => {
    switch (action) {
      case "retry":
        dispatch({ type: "RESET_ERROR" });
        return;
      case "openSettings":
        setSettingsOpen(true);
        return;
      case "refreshPage":
        window.location.reload();
        return;
      case "editUrl":
        dispatch({ type: "URL_CHANGED", url: "" });
        return;
    }
  };

  const handleSaveKeys = (newKeys: { youtube: string; anthropic: string }): void => {
    saveKeysFn(newKeys);
    setSettingsOpen(false);
    dispatch({ type: "KEYS_SAVED" });
  };

  const handleClearAll = (): void => {
    clearAll();
    clearKeysFn();
    setSettingsOpen(false);
    setHashVideoId(null);
    dispatch({ type: "KEYS_CLEARED" });
  };

  const urlValue = deriveUrl(state);
  const urlInputDisabled =
    state.kind === "fetching" ||
    state.kind === "analyzing" ||
    state.kind === "validating";

  const showModal = state.kind === "needs_keys" || settingsOpen;
  const modalMode = state.kind === "needs_keys" ? "first" : "edit";
  const renderedError = state.kind === "error" ? state.error : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-300">
      <OfflineBanner />
      <AriaLive politeMessage={politeMessage} assertiveMessage={assertiveMessage} />
      <Header onOpenSettings={() => setSettingsOpen(true)} />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {state.kind === "idle" && (
          <p className="text-neutral-400">{t("welcome.intro")}</p>
        )}

        {state.kind !== "needs_keys" && (
          <UrlInput
            value={urlValue}
            onChange={handleUrlChange}
            onSubmit={handleUrlSubmit}
            disabled={urlInputDisabled}
          />
        )}

        {state.kind === "metaLoading" && <VideoMetaPreview kind="loading" />}

        {state.kind === "metaReady" && state.videoMeta !== undefined && (
          <VideoMetaPreview
            kind="ready"
            meta={state.videoMeta}
            onAnalyze={handleAnalyze}
          />
        )}

        {state.kind === "metaReady" && state.videoMeta === undefined && (
          <VideoMetaPreview
            kind="fallback"
            videoId={state.videoId}
            errorMessage={t("meta.metaLoadError")}
            onAnalyze={handleAnalyze}
          />
        )}

        {(state.kind === "fetching" || state.kind === "analyzing") && (
          <ProgressIndicator
            phase={state.kind === "fetching" ? "fetching" : "analyzing"}
            onCancel={handleCancel}
          />
        )}

        {state.kind === "empty" && <EmptyState reason={state.reason} />}

        {state.kind === "result" && (
          <Dashboard
            videoId={state.videoId}
            {...(state.videoMeta !== undefined ? { videoMeta: state.videoMeta } : {})}
            report={state.report}
            commentCount={state.commentCount}
            fromCache={state.fromCache}
            {...(state.cachedAt !== undefined ? { cachedAt: state.cachedAt } : {})}
            {...(state.truncatedCount !== undefined
              ? { truncatedCount: state.truncatedCount }
              : {})}
            onReanalyze={handleReanalyze}
          />
        )}

        {renderedError !== null && (
          <ErrorBanner
            error={renderedError}
            actions={determineActions(renderedError)}
            onAction={handleErrorAction}
          />
        )}
      </main>

      {showModal && (
        <ApiKeyModal
          mode={modalMode}
          {...(keys !== null ? { currentKeys: keys } : {})}
          onSave={handleSaveKeys}
          onClose={() => setSettingsOpen(false)}
          onClearAll={handleClearAll}
        />
      )}

      <Toast messageKey={toastKey} onDismiss={() => setToastKey(null)} />
      <Footer />
    </div>
  );
}
