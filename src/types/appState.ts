import type { AppError } from "./errors";
import type { Report } from "./report";
import type { VideoMeta } from "./videoMeta";
import type { Comment } from "./youtube";

export type VideoId = string;

export type AppState =
  | { kind: "needs_keys" }
  | { kind: "idle"; url?: string }
  | {
      kind: "metaLoading";
      url: string;
      videoId: VideoId;
      controller: AbortController;
    }
  | {
      kind: "metaReady";
      videoId: VideoId;
      videoMeta?: VideoMeta;
      metaError?: AppError;
    }
  | {
      kind: "validating";
      videoId: VideoId;
      videoMeta?: VideoMeta;
      force?: boolean;
    }
  | {
      kind: "fetching";
      videoId: VideoId;
      videoMeta?: VideoMeta;
      controller: AbortController;
    }
  | {
      kind: "analyzing";
      videoId: VideoId;
      videoMeta?: VideoMeta;
      comments: Comment[];
      controller: AbortController;
    }
  | {
      kind: "result";
      videoId: VideoId;
      videoMeta?: VideoMeta;
      report: Report;
      commentCount: number;
      fromCache: boolean;
      cachedAt?: string;
      truncatedCount?: number;
    }
  | {
      kind: "empty";
      videoId: VideoId;
      videoMeta?: VideoMeta;
      reason: "commentsDisabled" | "noComments";
    }
  | { kind: "error"; error: AppError; previous: AppState };

export type Action =
  | { type: "KEYS_SAVED" }
  | { type: "KEYS_CLEARED" }
  | { type: "URL_CHANGED"; url: string }
  | {
      type: "META_FETCH_REQUESTED";
      videoId: VideoId;
      controller: AbortController;
    }
  | { type: "META_RESULT"; videoMeta?: VideoMeta; metaError?: AppError }
  | { type: "ANALYZE_REQUESTED" }
  | {
      type: "CACHE_HIT";
      report: Report;
      commentCount: number;
      cachedAt: string;
      truncatedCount?: number;
    }
  | { type: "FETCH_STARTED"; controller: AbortController }
  | { type: "ANALYZE_STARTED"; comments: Comment[]; controller: AbortController }
  | { type: "RESULT_READY"; report: Report; truncatedCount?: number }
  | { type: "EMPTY"; reason: "commentsDisabled" | "noComments" }
  | { type: "FAILED"; error: AppError }
  | { type: "CANCELLED" }
  | { type: "RESET_ERROR" }
  | { type: "REANALYZE" }
  | { type: "HASH_VIDEO_ID"; videoId: VideoId; controller: AbortController };
