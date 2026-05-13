import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoMeta } from "@/types/videoMeta";
import type { CachedMeta } from "./metaCache";
import { getMeta, setMeta } from "./metaCache";
import { __resetForTests, getStore } from "./storage";

function makeMeta(): VideoMeta {
  return {
    videoId: "abc",
    title: "title",
    channelTitle: "channel",
    thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
    commentCount: 42,
  };
}

describe("metaCache", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetForTests();
    getStore();
  });

  afterEach(() => {
    localStorage.clear();
    __resetForTests();
    vi.restoreAllMocks();
  });

  it("returns null when key missing", () => {
    expect(getMeta("abc")).toBeNull();
  });

  it("set/get round-trip", () => {
    setMeta("abc", makeMeta());
    expect(getMeta("abc")?.title).toBe("title");
  });

  it("returns null and deletes when JSON corrupted", () => {
    localStorage.setItem("videometa:abc", "garbage");
    expect(getMeta("abc")).toBeNull();
    expect(localStorage.getItem("videometa:abc")).toBeNull();
  });

  it("returns null when schemaVersion mismatch", () => {
    const bad = {
      schemaVersion: 99,
      fetchedAt: new Date().toISOString(),
      videoMeta: makeMeta(),
    };
    localStorage.setItem("videometa:abc", JSON.stringify(bad));
    expect(getMeta("abc")).toBeNull();
    expect(localStorage.getItem("videometa:abc")).toBeNull();
  });

  it("returns null when TTL expired (> 1 hour)", () => {
    const expired: CachedMeta = {
      schemaVersion: 1,
      fetchedAt: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
      videoMeta: makeMeta(),
    };
    localStorage.setItem("videometa:abc", JSON.stringify(expired));
    expect(getMeta("abc")).toBeNull();
    expect(localStorage.getItem("videometa:abc")).toBeNull();
  });

  it("returns value when just under 1-hour TTL", () => {
    const fresh: CachedMeta = {
      schemaVersion: 1,
      fetchedAt: new Date(Date.now() - 59 * 60 * 1000).toISOString(),
      videoMeta: makeMeta(),
    };
    localStorage.setItem("videometa:abc", JSON.stringify(fresh));
    expect(getMeta("abc")?.title).toBe("title");
  });

  it("setMeta silently skips on quota error", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => setMeta("abc", makeMeta())).not.toThrow();
  });
});
