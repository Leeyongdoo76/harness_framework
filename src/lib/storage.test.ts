import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetForTests, getStore, isUsingFallback } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetForTests();
  });

  afterEach(() => {
    localStorage.clear();
    __resetForTests();
    vi.restoreAllMocks();
  });

  describe("localStorage adapter", () => {
    it("set/get round-trip", () => {
      const store = getStore();
      store.set("foo", "bar");
      expect(store.get("foo")).toBe("bar");
    });

    it("returns null for missing key", () => {
      expect(getStore().get("missing")).toBeNull();
    });

    it("remove clears key", () => {
      const store = getStore();
      store.set("foo", "bar");
      store.remove("foo");
      expect(store.get("foo")).toBeNull();
    });

    it("keys returns set keys", () => {
      const store = getStore();
      store.set("a", "1");
      store.set("b", "2");
      expect(new Set(store.keys())).toEqual(new Set(["a", "b"]));
    });

    it("isUsingFallback is false when localStorage works", () => {
      getStore();
      expect(isUsingFallback()).toBe(false);
    });
  });

  describe("fallback on SecurityError", () => {
    it("falls back to in-memory when setItem throws", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

      const store = getStore();
      expect(isUsingFallback()).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      setItemSpy.mockRestore();
      // After fallback we operate on the in-memory map regardless of localStorage state.
      store.set("foo", "bar");
      expect(store.get("foo")).toBe("bar");
      // localStorage was never written to.
      expect(localStorage.getItem("foo")).toBeNull();
    });

    it("memory adapter supports keys() and remove()", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      const store = getStore();
      store.set("a", "1");
      store.set("b", "2");
      expect(new Set(store.keys())).toEqual(new Set(["a", "b"]));
      store.remove("a");
      expect(store.get("a")).toBeNull();
      expect(new Set(store.keys())).toEqual(new Set(["b"]));
    });
  });
});
