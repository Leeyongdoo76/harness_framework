import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentTitle } from "./pageTitle";

describe("useDocumentTitle", () => {
  let original: string;

  beforeEach(() => {
    original = document.title;
  });

  afterEach(() => {
    document.title = original;
  });

  it("sets document.title on mount", () => {
    renderHook(() => useDocumentTitle("hello"));
    expect(document.title).toBe("hello");
  });

  it("updates document.title when prop changes", () => {
    const { rerender } = renderHook(({ t }: { t: string }) => useDocumentTitle(t), {
      initialProps: { t: "one" },
    });
    expect(document.title).toBe("one");
    rerender({ t: "two" });
    expect(document.title).toBe("two");
  });
});
