import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { fetchTopComments, fetchVideoMeta } from "./youtube";

const VIDEO_ID = "dQw4w9WgXcQ";
const API_KEY = "AIzaTEST";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function youtubeErrorBody(reason: string): unknown {
  return { error: { code: 403, message: reason, errors: [{ reason }] } };
}

function abortLikeError(): Error {
  const e = new Error("aborted");
  e.name = "AbortError";
  return e;
}

type FetchSpy = ReturnType<typeof spyOnFetch>;
function spyOnFetch() {
  return vi.spyOn(globalThis, "fetch");
}

describe("fetchVideoMeta", () => {
  let fetchSpy: FetchSpy;

  beforeEach(() => {
    fetchSpy = spyOnFetch();
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("maps a successful response to VideoMeta", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          {
            id: VIDEO_ID,
            snippet: {
              title: "Hello",
              channelTitle: "Channel A",
              thumbnails: {
                default: { url: "https://i.ytimg.com/default.jpg" },
                medium: { url: "https://i.ytimg.com/medium.jpg" },
              },
            },
            statistics: { commentCount: "1234" },
          },
        ],
      }),
    );

    const meta = await fetchVideoMeta(VIDEO_ID, API_KEY);

    expect(meta).toEqual({
      videoId: VIDEO_ID,
      title: "Hello",
      channelTitle: "Channel A",
      thumbnailUrl: "https://i.ytimg.com/medium.jpg",
      commentCount: 1234,
    });

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("https://www.googleapis.com/youtube/v3/videos");
    expect(calledUrl).toContain("part=snippet%2Cstatistics");
    expect(calledUrl).toContain(`id=${VIDEO_ID}`);
    expect(calledUrl).toContain(`key=${API_KEY}`);
  });

  it("falls back to default thumbnail when medium absent", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          {
            id: VIDEO_ID,
            snippet: {
              title: "T",
              channelTitle: "C",
              thumbnails: { default: { url: "https://i.ytimg.com/default.jpg" } },
            },
            statistics: {},
          },
        ],
      }),
    );

    const meta = await fetchVideoMeta(VIDEO_ID, API_KEY);
    expect(meta.thumbnailUrl).toBe("https://i.ytimg.com/default.jpg");
    expect(meta.commentCount).toBeUndefined();
  });

  it("returns empty thumbnailUrl when no thumbnails available", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          {
            id: VIDEO_ID,
            snippet: { title: "T", channelTitle: "C" },
            statistics: { commentCount: "0" },
          },
        ],
      }),
    );
    const meta = await fetchVideoMeta(VIDEO_ID, API_KEY);
    expect(meta.thumbnailUrl).toBe("");
    expect(meta.commentCount).toBe(0);
  });

  it("throws YouTubeNotFoundError on 200 with empty items", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeNotFoundError);
  });

  it("throws YouTubeAuthError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(401, youtubeErrorBody("unauthorized")));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeAuthError);
  });

  it("throws YouTubeAuthError on 403 keyInvalid", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(403, youtubeErrorBody("keyInvalid")));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeAuthError);
  });

  it("throws YouTubeQuotaError on 403 quotaExceeded", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(403, youtubeErrorBody("quotaExceeded")));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeQuotaError);
  });

  it("throws YouTubeNotFoundError on 404", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(404, youtubeErrorBody("videoNotFound")));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeNotFoundError);
  });

  it("throws YouTubeBadRequestError on 400", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(400, youtubeErrorBody("invalidArgument")));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeBadRequestError);
  });

  it("throws YouTubeServerError on 500", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(500, { error: { code: 500 } }));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeServerError);
  });

  it("throws NetworkError when fetch rejects with TypeError", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(NetworkError);
  });

  it("does not retry on 5xx (single call)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(500, {}));
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeServerError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("forwards AbortError when signal aborts", async () => {
    fetchSpy.mockRejectedValueOnce(abortLikeError());
    const controller = new AbortController();
    controller.abort();
    await expect(fetchVideoMeta(VIDEO_ID, API_KEY, controller.signal)).rejects.toBeInstanceOf(
      AbortError,
    );
  });

  it("passes signal to fetch", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          { id: VIDEO_ID, snippet: { title: "T", channelTitle: "C" }, statistics: {} },
        ],
      }),
    );
    const controller = new AbortController();
    await fetchVideoMeta(VIDEO_ID, API_KEY, controller.signal);
    const opts = fetchSpy.mock.calls[0]?.[1];
    expect(opts).toBeDefined();
    expect((opts as { signal?: AbortSignal }).signal).toBe(controller.signal);
  });
});

describe("fetchTopComments", () => {
  let fetchSpy: FetchSpy;

  beforeEach(() => {
    fetchSpy = spyOnFetch();
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });

  function buildItems(n: number): unknown[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `c${i}`,
      snippet: {
        topLevelComment: {
          snippet: {
            textOriginal: `text ${i}`,
            authorDisplayName: i === 0 ? null : `user${i}`,
            likeCount: i,
          },
        },
      },
    }));
  }

  it("maps a successful 100-item response and uses textOriginal", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { items: buildItems(100) }));
    const comments = await fetchTopComments(VIDEO_ID, API_KEY);
    expect(comments).toHaveLength(100);
    expect(comments[0]).toEqual({ id: "c0", text: "text 0", likeCount: 0, author: "익명" });
    expect(comments[1]).toEqual({ id: "c1", text: "text 1", likeCount: 1, author: "user1" });

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("https://www.googleapis.com/youtube/v3/commentThreads");
    expect(calledUrl).toContain("part=snippet");
    expect(calledUrl).toContain("maxResults=100");
    expect(calledUrl).toContain("order=relevance");
    expect(calledUrl).toContain("textFormat=plainText");
    expect(calledUrl).toContain(`videoId=${VIDEO_ID}`);
    expect(calledUrl).toContain(`key=${API_KEY}`);
    expect(calledUrl).not.toContain("pageToken");
  });

  it("returns [] when items missing or empty", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, {}));
    await expect(fetchTopComments(VIDEO_ID, API_KEY)).resolves.toEqual([]);
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    await expect(fetchTopComments(VIDEO_ID, API_KEY)).resolves.toEqual([]);
  });

  it("throws CommentsDisabledError on 403 commentsDisabled", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(403, youtubeErrorBody("commentsDisabled")));
    await expect(fetchTopComments(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(
      CommentsDisabledError,
    );
  });

  it("throws YouTubeQuotaError on 403 quotaExceeded", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(403, youtubeErrorBody("quotaExceeded")));
    await expect(fetchTopComments(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeQuotaError);
  });

  it("throws YouTubeAuthError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(401, youtubeErrorBody("unauthorized")));
    await expect(fetchTopComments(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeAuthError);
  });

  it("throws YouTubeNotFoundError on 404", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(404, youtubeErrorBody("videoNotFound")));
    await expect(fetchTopComments(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(YouTubeNotFoundError);
  });

  it("throws YouTubeBadRequestError on 400", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(400, youtubeErrorBody("invalidArgument")));
    await expect(fetchTopComments(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(
      YouTubeBadRequestError,
    );
  });

  it("retries once on 5xx and succeeds", async () => {
    vi.useFakeTimers();
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, { items: buildItems(2) }));
    const p = fetchTopComments(VIDEO_ID, API_KEY);
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws YouTubeServerError after retry exhausted on 5xx", async () => {
    vi.useFakeTimers();
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}));
    const p = fetchTopComments(VIDEO_ID, API_KEY);
    const settled = p.catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await settled;
    expect(err).toBeInstanceOf(YouTubeServerError);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("retries once on network failure then succeeds", async () => {
    vi.useFakeTimers();
    fetchSpy
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(jsonResponse(200, { items: buildItems(1) }));
    const p = fetchTopComments(VIDEO_ID, API_KEY);
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws NetworkError when retry exhausted on network failure", async () => {
    vi.useFakeTimers();
    fetchSpy
      .mockRejectedValueOnce(new TypeError("down"))
      .mockRejectedValueOnce(new TypeError("still down"));
    const p = fetchTopComments(VIDEO_ID, API_KEY);
    const settled = p.catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await settled;
    expect(err).toBeInstanceOf(NetworkError);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx (single call)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(403, youtubeErrorBody("commentsDisabled")));
    await expect(fetchTopComments(VIDEO_ID, API_KEY)).rejects.toBeInstanceOf(
      CommentsDisabledError,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("propagates AbortError when signal aborts immediately", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchSpy.mockRejectedValue(abortLikeError());
    await expect(fetchTopComments(VIDEO_ID, API_KEY, controller.signal)).rejects.toBeInstanceOf(
      AbortError,
    );
  });

  it("passes signal to fetch", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    const controller = new AbortController();
    await fetchTopComments(VIDEO_ID, API_KEY, controller.signal);
    const opts = fetchSpy.mock.calls[0]?.[1];
    expect((opts as { signal?: AbortSignal }).signal).toBe(controller.signal);
  });
});
