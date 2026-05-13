import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentsDisabledError, YouTubeServerError } from "@/types/errors";
import type { Report } from "@/types/report";
import type { VideoMeta } from "@/types/videoMeta";
import type { Comment } from "@/types/youtube";
import { setReport } from "./cache";
import { __resetForTests } from "./storage";

vi.mock("@/services/youtube", () => ({
  fetchTopComments: vi.fn(),
}));
vi.mock("@/services/claude", () => ({
  analyzeComments: vi.fn(),
}));

import { fetchTopComments } from "@/services/youtube";
import { analyzeComments } from "@/services/claude";
import { getOrAnalyze } from "./analyze";

const VID = "dQw4w9WgXcQ";

const META: VideoMeta = {
  videoId: VID,
  title: "T",
  channelTitle: "C",
  thumbnailUrl: "",
  commentCount: 3,
};

const REPORT: Report = {
  summary: "요약",
  detectedLanguage: "ko",
  sentiment: { positive: 70, neutral: 20, negative: 10 },
  strengths: [],
  improvements: [],
  keywords: [],
  notableComments: [],
};

const COMMENTS: Comment[] = [
  { id: "a", text: "great", likeCount: 5, author: "u1" },
  { id: "b", text: "ok", likeCount: 2, author: "u2" },
];

const fetchTopCommentsMock = fetchTopComments as unknown as ReturnType<typeof vi.fn>;
const analyzeCommentsMock = analyzeComments as unknown as ReturnType<typeof vi.fn>;

describe("getOrAnalyze", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetForTests();
    fetchTopCommentsMock.mockReset();
    analyzeCommentsMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    __resetForTests();
    vi.restoreAllMocks();
  });

  it("returns cached result when cache hit and force=false", async () => {
    setReport(VID, { report: REPORT, commentCount: 87, videoMeta: META });

    const result = await getOrAnalyze({
      videoId: VID,
      ytKey: "yt",
      anthKey: "anth",
    });

    expect(result.kind).toBe("cached");
    if (result.kind === "cached") {
      expect(result.report.summary).toBe("요약");
      expect(result.commentCount).toBe(87);
      expect(result.videoMeta).toEqual(META);
    }
    expect(fetchTopCommentsMock).not.toHaveBeenCalled();
    expect(analyzeCommentsMock).not.toHaveBeenCalled();
  });

  it("force=true bypasses cache", async () => {
    setReport(VID, { report: REPORT, commentCount: 87 });
    fetchTopCommentsMock.mockResolvedValue(COMMENTS);
    analyzeCommentsMock.mockResolvedValue(REPORT);

    const result = await getOrAnalyze({
      videoId: VID,
      ytKey: "yt",
      anthKey: "anth",
      force: true,
    });

    expect(result.kind).toBe("fresh");
    expect(fetchTopCommentsMock).toHaveBeenCalledTimes(1);
    expect(analyzeCommentsMock).toHaveBeenCalledTimes(1);
  });

  it("returns fresh result and caches it", async () => {
    fetchTopCommentsMock.mockResolvedValue(COMMENTS);
    analyzeCommentsMock.mockResolvedValue({ ...REPORT, truncatedCount: 5 });

    const result = await getOrAnalyze({
      videoId: VID,
      videoMeta: META,
      ytKey: "yt",
      anthKey: "anth",
    });

    expect(result.kind).toBe("fresh");
    if (result.kind === "fresh") {
      expect(result.commentCount).toBe(2);
      expect(result.truncatedCount).toBe(5);
      expect(result.videoMeta).toEqual(META);
    }
    const cachedRaw = localStorage.getItem(`report:${VID}`);
    expect(cachedRaw).not.toBeNull();
  });

  it("commentsDisabled → empty/commentsDisabled, no analyze call", async () => {
    fetchTopCommentsMock.mockRejectedValue(new CommentsDisabledError("disabled"));

    const result = await getOrAnalyze({
      videoId: VID,
      ytKey: "yt",
      anthKey: "anth",
    });

    expect(result).toEqual({ kind: "empty", reason: "commentsDisabled" });
    expect(analyzeCommentsMock).not.toHaveBeenCalled();
  });

  it("empty comment list → empty/noComments, no analyze call", async () => {
    fetchTopCommentsMock.mockResolvedValue([]);

    const result = await getOrAnalyze({
      videoId: VID,
      ytKey: "yt",
      anthKey: "anth",
    });

    expect(result).toEqual({ kind: "empty", reason: "noComments" });
    expect(analyzeCommentsMock).not.toHaveBeenCalled();
  });

  it("propagates domain errors from fetchTopComments", async () => {
    fetchTopCommentsMock.mockRejectedValue(new YouTubeServerError("boom"));

    await expect(
      getOrAnalyze({ videoId: VID, ytKey: "yt", anthKey: "anth" }),
    ).rejects.toBeInstanceOf(YouTubeServerError);
    expect(analyzeCommentsMock).not.toHaveBeenCalled();
  });

  it("invokes onFetchStarted with a controller before fetching", async () => {
    fetchTopCommentsMock.mockResolvedValue(COMMENTS);
    analyzeCommentsMock.mockResolvedValue(REPORT);

    const onFetchStarted = vi.fn();
    const onAnalyzeStarted = vi.fn();

    await getOrAnalyze({
      videoId: VID,
      ytKey: "yt",
      anthKey: "anth",
      onFetchStarted,
      onAnalyzeStarted,
    });

    expect(onFetchStarted).toHaveBeenCalledTimes(1);
    const ctlA = onFetchStarted.mock.calls[0]?.[0];
    expect(ctlA).toBeInstanceOf(AbortController);

    expect(onAnalyzeStarted).toHaveBeenCalledTimes(1);
    const [comments, ctlB] = onAnalyzeStarted.mock.calls[0] ?? [];
    expect(comments).toEqual(COMMENTS);
    expect(ctlB).toBeInstanceOf(AbortController);
    expect(ctlB).not.toBe(ctlA);
  });

  it("outer signal aborts immediately → AbortError before any call", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      getOrAnalyze({
        videoId: VID,
        ytKey: "yt",
        anthKey: "anth",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "ABORT" });
    expect(fetchTopCommentsMock).not.toHaveBeenCalled();
  });

  it("outer signal abort propagates to inner controllers", async () => {
    const outer = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    fetchTopCommentsMock.mockImplementation(
      async (_id: string, _key: string, signal?: AbortSignal) => {
        receivedSignal = signal;
        outer.abort();
        if (signal?.aborted) {
          const e = new Error("aborted") as Error & { name: string };
          e.name = "AbortError";
          throw e;
        }
        return [];
      },
    );

    await expect(
      getOrAnalyze({
        videoId: VID,
        ytKey: "yt",
        anthKey: "anth",
        signal: outer.signal,
      }),
    ).rejects.toBeDefined();
    expect(receivedSignal?.aborted).toBe(true);
  });
});
