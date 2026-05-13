import { withRetry } from "@/lib/retry";
import {
  AbortError,
  CommentsDisabledError,
  NetworkError,
  YouTubeAuthError,
  YouTubeBadRequestError,
  YouTubeNotFoundError,
  YouTubeQuotaError,
  YouTubeServerError,
} from "@/types/errors";
import type { VideoMeta } from "@/types/videoMeta";
import type {
  Comment,
  YouTubeCommentThreadsResponse,
  YouTubeVideosResponse,
} from "@/types/youtube";

const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const COMMENT_THREADS_URL = "https://www.googleapis.com/youtube/v3/commentThreads";

type YouTubeErrorBody = {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
};

function isAbortError(e: unknown): boolean {
  if (e instanceof AbortError) return true;
  if (e instanceof Error && e.name === "AbortError") return true;
  return false;
}

async function readErrorReason(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as YouTubeErrorBody;
    const reason = body.error?.errors?.[0]?.reason;
    return typeof reason === "string" ? reason : null;
  } catch {
    return null;
  }
}

function buildVideosUrl(videoId: string, apiKey: string): string {
  const url = new URL(VIDEOS_URL);
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function buildCommentThreadsUrl(videoId: string, apiKey: string): string {
  const url = new URL(COMMENT_THREADS_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("maxResults", "100");
  url.searchParams.set("order", "relevance");
  url.searchParams.set("textFormat", "plainText");
  url.searchParams.set("videoId", videoId);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

async function safeFetch(url: string, signal: AbortSignal | undefined): Promise<Response> {
  try {
    return await fetch(url, signal !== undefined ? { signal } : {});
  } catch (e) {
    if (isAbortError(e)) {
      throw new AbortError("aborted");
    }
    throw new NetworkError("network failure", e);
  }
}

export async function fetchVideoMeta(
  videoId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<VideoMeta> {
  const res = await safeFetch(buildVideosUrl(videoId, apiKey), signal);

  if (res.ok) {
    const data = (await res.json()) as YouTubeVideosResponse;
    const item = data.items?.[0];
    if (!item || !item.snippet) {
      throw new YouTubeNotFoundError("video not found");
    }
    const thumbnail =
      item.snippet.thumbnails?.medium?.url ??
      item.snippet.thumbnails?.default?.url ??
      "";
    let commentCount: number | undefined;
    const raw = item.statistics?.commentCount;
    if (typeof raw === "string") {
      const n = Number.parseInt(raw, 10);
      commentCount = Number.isFinite(n) ? n : undefined;
    }
    return {
      videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: thumbnail,
      commentCount,
    };
  }

  const status = res.status;
  if (status === 401) throw new YouTubeAuthError("auth failed");
  if (status === 403) {
    const reason = await readErrorReason(res);
    if (reason === "quotaExceeded") throw new YouTubeQuotaError("quota exceeded");
    throw new YouTubeAuthError("auth failed");
  }
  if (status === 404) throw new YouTubeNotFoundError("not found");
  if (status === 400) throw new YouTubeBadRequestError("bad request");
  if (status >= 500) throw new YouTubeServerError(`server error ${status}`);
  throw new YouTubeBadRequestError(`unexpected status ${status}`);
}

async function fetchCommentsOnce(
  videoId: string,
  apiKey: string,
  signal: AbortSignal | undefined,
): Promise<Comment[]> {
  const res = await safeFetch(buildCommentThreadsUrl(videoId, apiKey), signal);

  if (res.ok) {
    const data = (await res.json()) as YouTubeCommentThreadsResponse;
    const items = data.items ?? [];
    return items.map(
      (it): Comment => ({
        id: it.id,
        text: it.snippet.topLevelComment.snippet.textOriginal,
        likeCount: it.snippet.topLevelComment.snippet.likeCount,
        author: it.snippet.topLevelComment.snippet.authorDisplayName ?? "익명",
      }),
    );
  }

  const status = res.status;
  if (status === 401) throw new YouTubeAuthError("auth failed");
  if (status === 403) {
    const reason = await readErrorReason(res);
    if (reason === "commentsDisabled") throw new CommentsDisabledError("comments disabled");
    if (reason === "quotaExceeded") throw new YouTubeQuotaError("quota exceeded");
    throw new YouTubeAuthError("auth failed");
  }
  if (status === 404) throw new YouTubeNotFoundError("not found");
  if (status === 400) throw new YouTubeBadRequestError("bad request");
  if (status >= 500) throw new YouTubeServerError(`server error ${status}`);
  throw new YouTubeBadRequestError(`unexpected status ${status}`);
}

export async function fetchTopComments(
  videoId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<Comment[]> {
  return withRetry(() => fetchCommentsOnce(videoId, apiKey, signal), {
    maxAttempts: 2,
    baseDelayMs: 1000,
    shouldRetry: (e) => e instanceof YouTubeServerError || e instanceof NetworkError,
    ...(signal !== undefined ? { signal } : {}),
  });
}
