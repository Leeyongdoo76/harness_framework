import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageError } from "@/types/errors";
import type { Report } from "@/types/report";
import { getReport, setReport, type CachedEntry } from "./cache";
import { __resetForTests, getStore } from "./storage";

function makeReport(summary = "ok"): Report {
  return {
    summary,
    detectedLanguage: "ko",
    sentiment: { positive: 60, neutral: 30, negative: 10 },
    strengths: [],
    improvements: [],
    keywords: [],
    notableComments: [],
  };
}

describe("cache.getReport", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetForTests();
  });

  afterEach(() => {
    localStorage.clear();
    __resetForTests();
    vi.restoreAllMocks();
  });

  it("returns null when key missing", () => {
    expect(getReport("abc")).toBeNull();
  });

  it("returns value for fresh entry", () => {
    setReport("abc", { report: makeReport(), commentCount: 50 });
    const got = getReport("abc");
    expect(got?.report.summary).toBe("ok");
    expect(got?.commentCount).toBe(50);
    expect(got?.schemaVersion).toBe(1);
  });

  it("deletes and returns null when JSON corrupted", () => {
    localStorage.setItem("report:abc", "{not json");
    expect(getReport("abc")).toBeNull();
    expect(localStorage.getItem("report:abc")).toBeNull();
  });

  it("deletes and returns null when schemaVersion mismatch", () => {
    const bad = {
      schemaVersion: 99,
      createdAt: new Date().toISOString(),
      report: makeReport(),
      commentCount: 10,
    };
    localStorage.setItem("report:abc", JSON.stringify(bad));
    expect(getReport("abc")).toBeNull();
    expect(localStorage.getItem("report:abc")).toBeNull();
  });

  it("deletes and returns null when TTL expired (> 30 days)", () => {
    const old: CachedEntry = {
      schemaVersion: 1,
      createdAt: new Date(Date.now() - 31 * 86400 * 1000).toISOString(),
      report: makeReport(),
      commentCount: 10,
    };
    localStorage.setItem("report:abc", JSON.stringify(old));
    expect(getReport("abc")).toBeNull();
    expect(localStorage.getItem("report:abc")).toBeNull();
  });

  it("returns value when just under 30-day TTL", () => {
    const recent: CachedEntry = {
      schemaVersion: 1,
      createdAt: new Date(Date.now() - 29 * 86400 * 1000).toISOString(),
      report: makeReport("recent"),
      commentCount: 10,
    };
    localStorage.setItem("report:abc", JSON.stringify(recent));
    expect(getReport("abc")?.report.summary).toBe("recent");
  });

  it("deletes when shape is invalid", () => {
    localStorage.setItem("report:abc", JSON.stringify({ totally: "wrong" }));
    expect(getReport("abc")).toBeNull();
    expect(localStorage.getItem("report:abc")).toBeNull();
  });
});

describe("cache.setReport", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetForTests();
    // Warm up the store so it commits to the localStorage adapter before any
    // test installs a throwing spy (otherwise the probe would fail and the
    // store would silently fall back to in-memory).
    getStore();
  });

  afterEach(() => {
    localStorage.clear();
    __resetForTests();
    vi.restoreAllMocks();
  });

  it("writes the entry to localStorage", () => {
    setReport("abc", { report: makeReport("hi"), commentCount: 42 });
    const raw = localStorage.getItem("report:abc");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "null");
    expect(parsed.report.summary).toBe("hi");
    expect(parsed.commentCount).toBe(42);
  });

  it("evicts oldest report:* on quota error then retries", () => {
    const old: CachedEntry = {
      schemaVersion: 1,
      createdAt: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
      report: makeReport("old"),
      commentCount: 5,
    };
    const newer: CachedEntry = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      report: makeReport("newer"),
      commentCount: 8,
    };
    localStorage.setItem("report:old", JSON.stringify(old));
    localStorage.setItem("report:newer", JSON.stringify(newer));

    const original = localStorage.setItem.bind(localStorage);
    let throwOnce = true;
    vi.spyOn(localStorage, "setItem").mockImplementation((k: string, v: string) => {
      if (k === "report:fresh" && throwOnce) {
        throwOnce = false;
        throw new DOMException("quota", "QuotaExceededError");
      }
      original(k, v);
    });

    setReport("fresh", { report: makeReport("fresh"), commentCount: 9 });
    expect(localStorage.getItem("report:old")).toBeNull();
    expect(localStorage.getItem("report:fresh")).not.toBeNull();
    expect(localStorage.getItem("report:newer")).not.toBeNull();
  });

  it("throws StorageError when no evictable entries", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => setReport("fresh", { report: makeReport(), commentCount: 1 })).toThrow(StorageError);
  });

  it("throws StorageError when retry after eviction still fails", () => {
    const old: CachedEntry = {
      schemaVersion: 1,
      createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
      report: makeReport("old"),
      commentCount: 1,
    };
    localStorage.setItem("report:old", JSON.stringify(old));
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => setReport("fresh", { report: makeReport(), commentCount: 1 })).toThrow(StorageError);
  });

  it("wraps non-quota write errors as StorageError", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("disk on fire");
    });
    expect(() => setReport("abc", { report: makeReport(), commentCount: 1 })).toThrow(StorageError);
  });
});
