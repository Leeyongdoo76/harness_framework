import { describe, expect, it } from "vitest";
import { t } from "./copy";

describe("t", () => {
  it("returns plain string for parameter-less key", () => {
    expect(t("header.title")).toBe("YouTube 댓글 분석");
  });

  it("substitutes a single named parameter", () => {
    expect(t("meta.commentCountFormat", { count: 87 })).toBe("87개");
  });

  it("substitutes multiple named parameters", () => {
    expect(t("result.headerCached", { relativeTime: "3일 전", count: 42 })).toBe(
      "3일 전 분석 · 캐시된 결과 · 댓글 42개 기준",
    );
  });

  it("leaves placeholder intact when param missing", () => {
    expect(t("meta.commentCountFormat")).toBe("{count}개");
  });

  it("coerces numeric param via String()", () => {
    expect(t("relTime.minutesAgo", { n: 5 })).toBe("5분 전");
  });

  it("returns the same string for known error/code keys", () => {
    expect(t("error.retry")).toBe("다시 시도");
    expect(t("boundary.refresh")).toBe("새로고침");
    expect(t("relTime.over30Days")).toBe("30일 이상 전");
  });
});
