import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { buildHash, parseHashVideoId, useUrlHash } from "./urlHash";

describe("parseHashVideoId", () => {
  it("parses valid 11-char id", () => {
    expect(parseHashVideoId("#v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseHashVideoId("#v=abcDEF-_123")).toBe("abcDEF-_123");
  });

  it("rejects wrong length", () => {
    expect(parseHashVideoId("#v=abc")).toBeNull();
    expect(parseHashVideoId("#v=dQw4w9WgXcQQ")).toBeNull();
  });

  it("rejects invalid chars", () => {
    expect(parseHashVideoId("#v=dQw4w9WgXc!")).toBeNull();
    expect(parseHashVideoId("#v=dQw4w9WgXc ")).toBeNull();
  });

  it("rejects missing prefix", () => {
    expect(parseHashVideoId("v=dQw4w9WgXcQ")).toBeNull();
    expect(parseHashVideoId("#dQw4w9WgXcQ")).toBeNull();
    expect(parseHashVideoId("")).toBeNull();
  });

  it("rejects extra params", () => {
    expect(parseHashVideoId("#v=dQw4w9WgXcQ&foo=bar")).toBeNull();
  });
});

describe("buildHash", () => {
  it("prefixes #v=", () => {
    expect(buildHash("dQw4w9WgXcQ")).toBe("#v=dQw4w9WgXcQ");
  });
});

describe("useUrlHash", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  afterEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("returns null when no hash", () => {
    const { result } = renderHook(() => useUrlHash());
    expect(result.current.videoId).toBeNull();
  });

  it("reads existing hash on mount", () => {
    window.history.replaceState(null, "", "#v=dQw4w9WgXcQ");
    const { result } = renderHook(() => useUrlHash());
    expect(result.current.videoId).toBe("dQw4w9WgXcQ");
  });

  it("setVideoId(id) updates location.hash via replaceState", () => {
    const { result } = renderHook(() => useUrlHash());
    act(() => {
      result.current.setVideoId("dQw4w9WgXcQ");
    });
    expect(window.location.hash).toBe("#v=dQw4w9WgXcQ");
    expect(result.current.videoId).toBe("dQw4w9WgXcQ");
  });

  it("setVideoId(null) clears the hash", () => {
    window.history.replaceState(null, "", "#v=dQw4w9WgXcQ");
    const { result } = renderHook(() => useUrlHash());
    expect(result.current.videoId).toBe("dQw4w9WgXcQ");
    act(() => {
      result.current.setVideoId(null);
    });
    expect(window.location.hash).toBe("");
    expect(result.current.videoId).toBeNull();
  });

  it("responds to hashchange events", () => {
    const { result } = renderHook(() => useUrlHash());
    act(() => {
      window.history.replaceState(null, "", "#v=abcDEF-_123");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current.videoId).toBe("abcDEF-_123");
  });

  it("setVideoId does not push history entries", () => {
    const lengthBefore = window.history.length;
    const { result } = renderHook(() => useUrlHash());
    act(() => {
      result.current.setVideoId("dQw4w9WgXcQ");
    });
    act(() => {
      result.current.setVideoId("aaaaaaaaaaa");
    });
    expect(window.history.length).toBe(lengthBefore);
  });
});
