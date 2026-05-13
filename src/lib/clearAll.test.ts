import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAll } from "./clearAll";
import { __resetForTests, getStore } from "./storage";

describe("clearAll", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetForTests();
  });
  afterEach(() => {
    localStorage.clear();
    __resetForTests();
  });

  it("removes all four-prefix keys and preserves unrelated keys", () => {
    const store = getStore();
    store.set("keys:youtube", "y");
    store.set("keys:anthropic", "a");
    store.set("report:abc", "{}");
    store.set("videometa:abc", "{}");
    store.set("flag:onboarded", "1");
    store.set("other:foo", "bar");
    store.set("misc", "baz");

    clearAll();

    expect(store.get("keys:youtube")).toBeNull();
    expect(store.get("keys:anthropic")).toBeNull();
    expect(store.get("report:abc")).toBeNull();
    expect(store.get("videometa:abc")).toBeNull();
    expect(store.get("flag:onboarded")).toBeNull();
    expect(store.get("other:foo")).toBe("bar");
    expect(store.get("misc")).toBe("baz");
  });

  it("is a no-op when no matching keys exist", () => {
    const store = getStore();
    store.set("other:x", "1");
    expect(() => clearAll()).not.toThrow();
    expect(store.get("other:x")).toBe("1");
  });
});
