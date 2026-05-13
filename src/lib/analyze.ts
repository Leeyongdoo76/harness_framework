import { analyzeComments } from "@/services/claude";
import { fetchTopComments } from "@/services/youtube";
import { AbortError, CommentsDisabledError } from "@/types/errors";
import type { Report } from "@/types/report";
import type { VideoMeta } from "@/types/videoMeta";
import type { Comment } from "@/types/youtube";
import { getReport, setReport } from "./cache";

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
  | {
      kind: "cached";
      report: Report;
      videoMeta?: VideoMeta;
      cachedAt: string;
      commentCount: number;
      truncatedCount?: number;
    }
  | {
      kind: "fresh";
      report: Report;
      videoMeta?: VideoMeta;
      commentCount: number;
      truncatedCount?: number;
    }
  | { kind: "empty"; reason: "commentsDisabled" | "noComments" };

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AbortError("aborted");
}

function linkSignals(
  outer: AbortSignal | undefined,
  inner: AbortController,
): () => void {
  if (outer === undefined) return () => undefined;
  if (outer.aborted) {
    inner.abort();
    return () => undefined;
  }
  const onAbort = (): void => inner.abort();
  outer.addEventListener("abort", onAbort, { once: true });
  return () => outer.removeEventListener("abort", onAbort);
}

export async function getOrAnalyze(opts: AnalyzeOptions): Promise<AnalyzeResult> {
  throwIfAborted(opts.signal);

  if (opts.force !== true) {
    const cached = getReport(opts.videoId);
    if (cached !== null) {
      const result: AnalyzeResult = {
        kind: "cached",
        report: cached.report,
        cachedAt: cached.createdAt,
        commentCount: cached.commentCount,
      };
      const videoMeta = cached.videoMeta ?? opts.videoMeta;
      if (videoMeta !== undefined) result.videoMeta = videoMeta;
      if (cached.truncatedCount !== undefined) result.truncatedCount = cached.truncatedCount;
      return result;
    }
  }

  let comments: Comment[];
  const fetchController = new AbortController();
  const unlinkFetch = linkSignals(opts.signal, fetchController);
  try {
    opts.onFetchStarted?.(fetchController);
    try {
      comments = await fetchTopComments(opts.videoId, opts.ytKey, fetchController.signal);
    } catch (e) {
      if (e instanceof CommentsDisabledError) {
        return { kind: "empty", reason: "commentsDisabled" };
      }
      throw e;
    }
  } finally {
    unlinkFetch();
  }
  throwIfAborted(opts.signal);

  if (comments.length === 0) {
    return { kind: "empty", reason: "noComments" };
  }

  const analyzeController = new AbortController();
  const unlinkAnalyze = linkSignals(opts.signal, analyzeController);
  let analysis;
  try {
    opts.onAnalyzeStarted?.(comments, analyzeController);
    analysis = await analyzeComments(comments, opts.anthKey, analyzeController.signal);
  } finally {
    unlinkAnalyze();
  }
  throwIfAborted(opts.signal);

  const { truncatedCount, ...report } = analysis;
  const cacheInput: Parameters<typeof setReport>[1] = {
    report,
    commentCount: comments.length,
  };
  if (opts.videoMeta !== undefined) cacheInput.videoMeta = opts.videoMeta;
  if (truncatedCount !== undefined) cacheInput.truncatedCount = truncatedCount;
  setReport(opts.videoId, cacheInput);

  const result: AnalyzeResult = {
    kind: "fresh",
    report,
    commentCount: comments.length,
  };
  if (opts.videoMeta !== undefined) result.videoMeta = opts.videoMeta;
  if (truncatedCount !== undefined) result.truncatedCount = truncatedCount;
  return result;
}
