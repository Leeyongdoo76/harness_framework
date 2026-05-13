import { describe, expect, it } from "vitest";
import {
  AbortError,
  ClaudeAuthError,
  NetworkError,
  YouTubeAuthError,
  YouTubeServerError,
} from "@/types/errors";
import type { Report } from "@/types/report";
import type { VideoMeta } from "@/types/videoMeta";
import type { Comment } from "@/types/youtube";
import type { AppState } from "@/types/appState";
import { initialState, reducer } from "./reducer";

const VID = "dQw4w9WgXcQ";

const META: VideoMeta = {
  videoId: VID,
  title: "Title",
  channelTitle: "Channel",
  thumbnailUrl: "https://i.ytimg.com/vi/x/default.jpg",
  commentCount: 42,
};

const COMMENTS: Comment[] = [
  { id: "c1", text: "good", likeCount: 10, author: "a" },
];

const REPORT: Report = {
  summary: "요약",
  detectedLanguage: "ko",
  sentiment: { positive: 70, neutral: 20, negative: 10 },
  strengths: [],
  improvements: [],
  keywords: [],
  notableComments: [],
};

function makeCtl(): AbortController {
  return new AbortController();
}

describe("initialState", () => {
  it("hasKeys=false → needs_keys", () => {
    expect(initialState({ hasKeys: false })).toEqual({ kind: "needs_keys" });
  });
  it("hasKeys=true → idle", () => {
    expect(initialState({ hasKeys: true })).toEqual({ kind: "idle" });
  });
});

describe("reducer — happy path A→H", () => {
  it("KEYS_SAVED: needs_keys → idle", () => {
    const next = reducer({ kind: "needs_keys" }, { type: "KEYS_SAVED" });
    expect(next).toEqual({ kind: "idle" });
  });

  it("URL_CHANGED: idle → idle with url", () => {
    const next = reducer({ kind: "idle" }, { type: "URL_CHANGED", url: "x" });
    expect(next).toEqual({ kind: "idle", url: "x" });
  });

  it("META_FETCH_REQUESTED → metaLoading", () => {
    const ctl = makeCtl();
    const next = reducer(
      { kind: "idle", url: "x" },
      { type: "META_FETCH_REQUESTED", videoId: VID, controller: ctl },
    );
    expect(next.kind).toBe("metaLoading");
    if (next.kind === "metaLoading") {
      expect(next.videoId).toBe(VID);
      expect(next.controller).toBe(ctl);
    }
  });

  it("META_RESULT (videoMeta) on metaLoading → metaReady", () => {
    const before: AppState = {
      kind: "metaLoading",
      url: "x",
      videoId: VID,
      controller: makeCtl(),
    };
    const next = reducer(before, { type: "META_RESULT", videoMeta: META });
    expect(next).toEqual({ kind: "metaReady", videoId: VID, videoMeta: META });
  });

  it("META_RESULT (metaError) on metaLoading → metaReady with error", () => {
    const before: AppState = {
      kind: "metaLoading",
      url: "x",
      videoId: VID,
      controller: makeCtl(),
    };
    const err = new YouTubeServerError("fail");
    const next = reducer(before, { type: "META_RESULT", metaError: err });
    expect(next.kind).toBe("metaReady");
    if (next.kind === "metaReady") {
      expect(next.metaError).toBe(err);
      expect(next.videoMeta).toBeUndefined();
    }
  });

  it("ANALYZE_REQUESTED on metaReady → validating(force=false)", () => {
    const next = reducer(
      { kind: "metaReady", videoId: VID, videoMeta: META },
      { type: "ANALYZE_REQUESTED" },
    );
    expect(next).toEqual({
      kind: "validating",
      videoId: VID,
      videoMeta: META,
      force: false,
    });
  });

  it("CACHE_HIT on validating → result(fromCache=true)", () => {
    const next = reducer(
      { kind: "validating", videoId: VID, videoMeta: META, force: false },
      {
        type: "CACHE_HIT",
        report: REPORT,
        commentCount: 42,
        cachedAt: "2026-05-13T00:00:00Z",
      },
    );
    expect(next.kind).toBe("result");
    if (next.kind === "result") {
      expect(next.fromCache).toBe(true);
      expect(next.commentCount).toBe(42);
      expect(next.cachedAt).toBe("2026-05-13T00:00:00Z");
    }
  });

  it("FETCH_STARTED on validating → fetching with controller", () => {
    const ctl = makeCtl();
    const next = reducer(
      { kind: "validating", videoId: VID, videoMeta: META, force: false },
      { type: "FETCH_STARTED", controller: ctl },
    );
    expect(next.kind).toBe("fetching");
    if (next.kind === "fetching") {
      expect(next.controller).toBe(ctl);
      expect(next.videoMeta).toEqual(META);
    }
  });

  it("ANALYZE_STARTED on fetching → analyzing with comments", () => {
    const ctl = makeCtl();
    const next = reducer(
      { kind: "fetching", videoId: VID, videoMeta: META, controller: makeCtl() },
      { type: "ANALYZE_STARTED", comments: COMMENTS, controller: ctl },
    );
    expect(next.kind).toBe("analyzing");
    if (next.kind === "analyzing") {
      expect(next.comments).toBe(COMMENTS);
      expect(next.controller).toBe(ctl);
    }
  });

  it("RESULT_READY on analyzing → result(fromCache=false, commentCount=comments.length)", () => {
    const next = reducer(
      {
        kind: "analyzing",
        videoId: VID,
        videoMeta: META,
        comments: COMMENTS,
        controller: makeCtl(),
      },
      { type: "RESULT_READY", report: REPORT, truncatedCount: 5 },
    );
    expect(next.kind).toBe("result");
    if (next.kind === "result") {
      expect(next.fromCache).toBe(false);
      expect(next.commentCount).toBe(1);
      expect(next.truncatedCount).toBe(5);
    }
  });

  it("EMPTY(commentsDisabled) on fetching → empty", () => {
    const next = reducer(
      { kind: "fetching", videoId: VID, videoMeta: META, controller: makeCtl() },
      { type: "EMPTY", reason: "commentsDisabled" },
    );
    expect(next).toEqual({
      kind: "empty",
      videoId: VID,
      videoMeta: META,
      reason: "commentsDisabled",
    });
  });
});

describe("reducer — error transitions (ADR-022)", () => {
  it("FAILED captures previous", () => {
    const before: AppState = { kind: "idle", url: "x" };
    const err = new YouTubeServerError("boom");
    const next = reducer(before, { type: "FAILED", error: err });
    expect(next.kind).toBe("error");
    if (next.kind === "error") {
      expect(next.error).toBe(err);
      expect(next.previous).toBe(before);
    }
  });

  it("FAILED on error does not nest — previous is preserved", () => {
    const orig: AppState = { kind: "idle", url: "x" };
    const first = reducer(orig, { type: "FAILED", error: new YouTubeServerError("e1") });
    expect(first.kind).toBe("error");
    const second = reducer(first, { type: "FAILED", error: new NetworkError("e2") });
    expect(second.kind).toBe("error");
    if (second.kind === "error") {
      expect(second.previous).toBe(orig);
      expect(second.error.code).toBe("NETWORK");
      if (second.previous.kind === "error") {
        throw new Error("previous should not be error");
      }
    }
  });

  it("FAILED with AbortError → state unchanged", () => {
    const before: AppState = {
      kind: "fetching",
      videoId: VID,
      controller: makeCtl(),
    };
    const next = reducer(before, { type: "FAILED", error: new AbortError("cancel") });
    expect(next).toBe(before);
  });

  it("RESET_ERROR → previous", () => {
    const prev: AppState = { kind: "idle", url: "x" };
    const errState: AppState = {
      kind: "error",
      error: new YouTubeServerError("e"),
      previous: prev,
    };
    expect(reducer(errState, { type: "RESET_ERROR" })).toBe(prev);
  });

  it("KEYS_SAVED on auth error → previous (YouTubeAuthError)", () => {
    const prev: AppState = { kind: "metaReady", videoId: VID, videoMeta: META };
    const errState: AppState = {
      kind: "error",
      error: new YouTubeAuthError("auth"),
      previous: prev,
    };
    expect(reducer(errState, { type: "KEYS_SAVED" })).toBe(prev);
  });

  it("KEYS_SAVED on auth error → previous (ClaudeAuthError)", () => {
    const prev: AppState = {
      kind: "analyzing",
      videoId: VID,
      comments: COMMENTS,
      controller: makeCtl(),
    };
    const errState: AppState = {
      kind: "error",
      error: new ClaudeAuthError("auth"),
      previous: prev,
    };
    expect(reducer(errState, { type: "KEYS_SAVED" })).toBe(prev);
  });

  it("KEYS_SAVED on non-auth error → state unchanged", () => {
    const errState: AppState = {
      kind: "error",
      error: new YouTubeServerError("e"),
      previous: { kind: "idle" },
    };
    expect(reducer(errState, { type: "KEYS_SAVED" })).toBe(errState);
  });
});

describe("reducer — cancellation and reset", () => {
  it("CANCELLED on metaLoading → idle", () => {
    const next = reducer(
      { kind: "metaLoading", url: "x", videoId: VID, controller: makeCtl() },
      { type: "CANCELLED" },
    );
    expect(next).toEqual({ kind: "idle" });
  });

  it("CANCELLED on fetching → idle", () => {
    const next = reducer(
      { kind: "fetching", videoId: VID, controller: makeCtl() },
      { type: "CANCELLED" },
    );
    expect(next).toEqual({ kind: "idle" });
  });

  it("CANCELLED on analyzing → idle", () => {
    const next = reducer(
      {
        kind: "analyzing",
        videoId: VID,
        comments: COMMENTS,
        controller: makeCtl(),
      },
      { type: "CANCELLED" },
    );
    expect(next).toEqual({ kind: "idle" });
  });

  it("CANCELLED on idle → state unchanged", () => {
    const s: AppState = { kind: "idle", url: "x" };
    expect(reducer(s, { type: "CANCELLED" })).toBe(s);
  });
});

describe("reducer — KEYS_CLEARED + URL_CHANGED rules", () => {
  it("KEYS_CLEARED from any state → needs_keys", () => {
    const s: AppState = { kind: "result", videoId: VID, report: REPORT, commentCount: 1, fromCache: false };
    expect(reducer(s, { type: "KEYS_CLEARED" })).toEqual({ kind: "needs_keys" });
  });

  it("URL_CHANGED ignored while analyzing", () => {
    const s: AppState = {
      kind: "analyzing",
      videoId: VID,
      comments: COMMENTS,
      controller: makeCtl(),
    };
    expect(reducer(s, { type: "URL_CHANGED", url: "y" })).toBe(s);
  });

  it("URL_CHANGED ignored while validating", () => {
    const s: AppState = { kind: "validating", videoId: VID, force: false };
    expect(reducer(s, { type: "URL_CHANGED", url: "y" })).toBe(s);
  });

  it("URL_CHANGED ignored while fetching", () => {
    const s: AppState = { kind: "fetching", videoId: VID, controller: makeCtl() };
    expect(reducer(s, { type: "URL_CHANGED", url: "y" })).toBe(s);
  });

  it("URL_CHANGED ignored on needs_keys", () => {
    const s: AppState = { kind: "needs_keys" };
    expect(reducer(s, { type: "URL_CHANGED", url: "y" })).toBe(s);
  });

  it("URL_CHANGED on metaReady → idle reset", () => {
    expect(
      reducer({ kind: "metaReady", videoId: VID, videoMeta: META }, { type: "URL_CHANGED", url: "y" }),
    ).toEqual({ kind: "idle", url: "y" });
  });

  it("URL_CHANGED on error → idle reset", () => {
    const s: AppState = {
      kind: "error",
      error: new YouTubeServerError("x"),
      previous: { kind: "idle" },
    };
    expect(reducer(s, { type: "URL_CHANGED", url: "y" })).toEqual({ kind: "idle", url: "y" });
  });
});

describe("reducer — REANALYZE / HASH_VIDEO_ID", () => {
  it("REANALYZE from result → validating(force=true)", () => {
    const s: AppState = {
      kind: "result",
      videoId: VID,
      videoMeta: META,
      report: REPORT,
      commentCount: 87,
      fromCache: true,
      cachedAt: "2026-05-10T00:00:00Z",
    };
    const next = reducer(s, { type: "REANALYZE" });
    expect(next).toEqual({
      kind: "validating",
      videoId: VID,
      videoMeta: META,
      force: true,
    });
  });

  it("REANALYZE ignored when not in result state", () => {
    const s: AppState = { kind: "idle" };
    expect(reducer(s, { type: "REANALYZE" })).toBe(s);
  });

  it("HASH_VIDEO_ID from any state → metaLoading", () => {
    const ctl = makeCtl();
    const next = reducer(
      { kind: "needs_keys" },
      { type: "HASH_VIDEO_ID", videoId: VID, controller: ctl },
    );
    expect(next.kind).toBe("metaLoading");
    if (next.kind === "metaLoading") {
      expect(next.videoId).toBe(VID);
      expect(next.controller).toBe(ctl);
      expect(next.url).toContain(VID);
    }
  });
});

describe("reducer — invalid (state, action) pairs are no-ops", () => {
  it("RESULT_READY on idle → unchanged", () => {
    const s: AppState = { kind: "idle" };
    expect(reducer(s, { type: "RESULT_READY", report: REPORT })).toBe(s);
  });

  it("CACHE_HIT on idle → unchanged", () => {
    const s: AppState = { kind: "idle" };
    expect(
      reducer(s, {
        type: "CACHE_HIT",
        report: REPORT,
        commentCount: 0,
        cachedAt: "x",
      }),
    ).toBe(s);
  });

  it("ANALYZE_REQUESTED on idle → unchanged", () => {
    const s: AppState = { kind: "idle", url: "x" };
    expect(reducer(s, { type: "ANALYZE_REQUESTED" })).toBe(s);
  });

  it("FETCH_STARTED on idle → unchanged", () => {
    const s: AppState = { kind: "idle" };
    expect(
      reducer(s, { type: "FETCH_STARTED", controller: makeCtl() }),
    ).toBe(s);
  });

  it("ANALYZE_STARTED on idle → unchanged", () => {
    const s: AppState = { kind: "idle" };
    expect(
      reducer(s, {
        type: "ANALYZE_STARTED",
        comments: COMMENTS,
        controller: makeCtl(),
      }),
    ).toBe(s);
  });

  it("EMPTY on idle → unchanged", () => {
    const s: AppState = { kind: "idle" };
    expect(reducer(s, { type: "EMPTY", reason: "noComments" })).toBe(s);
  });

  it("META_RESULT on metaReady → unchanged (stale)", () => {
    const s: AppState = { kind: "metaReady", videoId: VID, videoMeta: META };
    expect(reducer(s, { type: "META_RESULT", videoMeta: META })).toBe(s);
  });

  it("RESET_ERROR on idle → unchanged", () => {
    const s: AppState = { kind: "idle" };
    expect(reducer(s, { type: "RESET_ERROR" })).toBe(s);
  });
});
