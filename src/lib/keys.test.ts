import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  __resetForTests as __resetKeysForTests,
  clearKeys,
  loadKeys,
  maskKey,
  saveKeys,
  useApiKeys,
} from "./keys";
import { __resetForTests as __resetStoreForTests } from "./storage";

describe("keys: load/save/clear", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStoreForTests();
    __resetKeysForTests();
  });

  afterEach(() => {
    localStorage.clear();
    __resetStoreForTests();
    __resetKeysForTests();
  });

  it("loadKeys returns null when nothing saved", () => {
    expect(loadKeys()).toBeNull();
  });

  it("loadKeys returns null when only one key present", () => {
    localStorage.setItem("keys:youtube", "AIzaXYZ");
    expect(loadKeys()).toBeNull();
  });

  it("loadKeys returns null when either key is empty string", () => {
    localStorage.setItem("keys:youtube", "");
    localStorage.setItem("keys:anthropic", "sk-ant-xxx");
    expect(loadKeys()).toBeNull();
  });

  it("saveKeys then loadKeys round-trip", () => {
    saveKeys({ youtube: "AIzaXYZ", anthropic: "sk-ant-xxx" });
    expect(loadKeys()).toEqual({ youtube: "AIzaXYZ", anthropic: "sk-ant-xxx" });
  });

  it("saveKeys trims input", () => {
    saveKeys({ youtube: "  AIzaXYZ  ", anthropic: " sk-ant-xxx\n" });
    expect(loadKeys()).toEqual({ youtube: "AIzaXYZ", anthropic: "sk-ant-xxx" });
  });

  it("saveKeys throws when either key trims to empty", () => {
    expect(() => saveKeys({ youtube: "   ", anthropic: "sk-ant" })).toThrow();
    expect(() => saveKeys({ youtube: "AIza", anthropic: "" })).toThrow();
  });

  it("clearKeys removes both", () => {
    saveKeys({ youtube: "a", anthropic: "b" });
    clearKeys();
    expect(loadKeys()).toBeNull();
    expect(localStorage.getItem("keys:youtube")).toBeNull();
    expect(localStorage.getItem("keys:anthropic")).toBeNull();
  });
});

describe("maskKey", () => {
  it("masks entirely when shorter than 8", () => {
    expect(maskKey("")).toBe("");
    expect(maskKey("abc")).toBe("•••");
    expect(maskKey("1234567")).toBe("•••••••");
  });

  it("shows last 4 chars with 8 bullets when >= 8", () => {
    expect(maskKey("12345678")).toBe("••••••••5678");
    expect(maskKey("AIzaSyABCDefghi1234")).toBe("••••••••1234");
    expect(maskKey("sk-ant-api03-abcd1234")).toBe("••••••••1234");
  });
});

describe("useApiKeys", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStoreForTests();
    __resetKeysForTests();
  });

  afterEach(() => {
    localStorage.clear();
    __resetStoreForTests();
    __resetKeysForTests();
  });

  it("returns null initially when no keys saved", () => {
    const { result } = renderHook(() => useApiKeys());
    expect(result.current.keys).toBeNull();
  });

  it("save updates keys and re-renders", () => {
    const { result } = renderHook(() => useApiKeys());
    act(() => {
      result.current.save({ youtube: "AIzaXYZ", anthropic: "sk-ant" });
    });
    expect(result.current.keys).toEqual({ youtube: "AIzaXYZ", anthropic: "sk-ant" });
  });

  it("clear sets keys to null", () => {
    const { result } = renderHook(() => useApiKeys());
    act(() => {
      result.current.save({ youtube: "a", anthropic: "b" });
    });
    expect(result.current.keys).not.toBeNull();
    act(() => {
      result.current.clear();
    });
    expect(result.current.keys).toBeNull();
  });

  it("syncs across multiple subscribers", () => {
    const a = renderHook(() => useApiKeys());
    const b = renderHook(() => useApiKeys());
    expect(a.result.current.keys).toBeNull();
    expect(b.result.current.keys).toBeNull();
    act(() => {
      a.result.current.save({ youtube: "y", anthropic: "z" });
    });
    expect(a.result.current.keys).toEqual({ youtube: "y", anthropic: "z" });
    expect(b.result.current.keys).toEqual({ youtube: "y", anthropic: "z" });
  });
});
