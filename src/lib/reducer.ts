import { AbortError, isAuthError } from "@/types/errors";
import type { Action, AppState, VideoId } from "@/types/appState";
import { getReport } from "./cache";

export type InitialStateOptions = {
  hasKeys: boolean;
  hashVideoId?: VideoId;
};

export function initialState(opts: InitialStateOptions): AppState {
  if (!opts.hasKeys) return { kind: "needs_keys" };
  // Hash + cache hit → bootstrap straight into result so reload restores the
  // last analysis without forcing the user to click "분석 시작" again.
  if (opts.hashVideoId !== undefined) {
    const cached = getReport(opts.hashVideoId);
    if (cached !== null) {
      const next: AppState = {
        kind: "result",
        videoId: opts.hashVideoId,
        report: cached.report,
        commentCount: cached.commentCount,
        fromCache: true,
        cachedAt: cached.createdAt,
      };
      if (cached.videoMeta !== undefined) next.videoMeta = cached.videoMeta;
      if (cached.truncatedCount !== undefined) {
        next.truncatedCount = cached.truncatedCount;
      }
      return next;
    }
  }
  return { kind: "idle" };
}

function hashUrlFor(videoId: VideoId): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "KEYS_SAVED": {
      if (state.kind === "needs_keys") return { kind: "idle" };
      if (state.kind === "error" && isAuthError(state.error)) return state.previous;
      return state;
    }

    case "KEYS_CLEARED":
      return { kind: "needs_keys" };

    case "URL_CHANGED": {
      if (
        state.kind === "needs_keys" ||
        state.kind === "validating" ||
        state.kind === "fetching" ||
        state.kind === "analyzing"
      ) {
        return state;
      }
      return { kind: "idle", url: action.url };
    }

    case "META_FETCH_REQUESTED":
      return {
        kind: "metaLoading",
        url: hashUrlFor(action.videoId),
        videoId: action.videoId,
        controller: action.controller,
      };

    case "META_RESULT": {
      if (state.kind !== "metaLoading") return state;
      const next: AppState = { kind: "metaReady", videoId: state.videoId };
      if (action.videoMeta !== undefined) next.videoMeta = action.videoMeta;
      if (action.metaError !== undefined) next.metaError = action.metaError;
      return next;
    }

    case "ANALYZE_REQUESTED": {
      if (state.kind !== "metaReady") return state;
      const next: AppState = {
        kind: "validating",
        videoId: state.videoId,
        force: false,
      };
      if (state.videoMeta !== undefined) next.videoMeta = state.videoMeta;
      return next;
    }

    case "CACHE_HIT": {
      if (state.kind !== "validating") return state;
      const next: AppState = {
        kind: "result",
        videoId: state.videoId,
        report: action.report,
        commentCount: action.commentCount,
        fromCache: true,
        cachedAt: action.cachedAt,
      };
      if (state.videoMeta !== undefined) next.videoMeta = state.videoMeta;
      if (action.truncatedCount !== undefined) next.truncatedCount = action.truncatedCount;
      return next;
    }

    case "FETCH_STARTED": {
      if (state.kind !== "validating") return state;
      const next: AppState = {
        kind: "fetching",
        videoId: state.videoId,
        controller: action.controller,
      };
      if (state.videoMeta !== undefined) next.videoMeta = state.videoMeta;
      return next;
    }

    case "ANALYZE_STARTED": {
      if (state.kind !== "fetching") return state;
      const next: AppState = {
        kind: "analyzing",
        videoId: state.videoId,
        comments: action.comments,
        controller: action.controller,
      };
      if (state.videoMeta !== undefined) next.videoMeta = state.videoMeta;
      return next;
    }

    case "RESULT_READY": {
      if (state.kind !== "analyzing") return state;
      const next: AppState = {
        kind: "result",
        videoId: state.videoId,
        report: action.report,
        commentCount: state.comments.length,
        fromCache: false,
      };
      if (state.videoMeta !== undefined) next.videoMeta = state.videoMeta;
      if (action.truncatedCount !== undefined) next.truncatedCount = action.truncatedCount;
      return next;
    }

    case "EMPTY": {
      if (state.kind !== "fetching") return state;
      const next: AppState = {
        kind: "empty",
        videoId: state.videoId,
        reason: action.reason,
      };
      if (state.videoMeta !== undefined) next.videoMeta = state.videoMeta;
      return next;
    }

    case "FAILED": {
      if (action.error instanceof AbortError) return state;
      if (state.kind === "error") {
        return { kind: "error", error: action.error, previous: state.previous };
      }
      return { kind: "error", error: action.error, previous: state };
    }

    case "CANCELLED": {
      if (
        state.kind === "metaLoading" ||
        state.kind === "fetching" ||
        state.kind === "analyzing"
      ) {
        return { kind: "idle" };
      }
      return state;
    }

    case "RESET_ERROR": {
      if (state.kind !== "error") return state;
      return state.previous;
    }

    case "REANALYZE": {
      if (state.kind !== "result") return state;
      const next: AppState = {
        kind: "validating",
        videoId: state.videoId,
        force: true,
      };
      if (state.videoMeta !== undefined) next.videoMeta = state.videoMeta;
      return next;
    }

    case "HASH_VIDEO_ID":
      return {
        kind: "metaLoading",
        url: hashUrlFor(action.videoId),
        videoId: action.videoId,
        controller: action.controller,
      };

    default:
      return state;
  }
}
