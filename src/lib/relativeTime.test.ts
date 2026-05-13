import { describe, expect, it } from "vitest";
import { toRelativeKorean } from "./relativeTime";

const NOW = new Date("2026-05-13T12:00:00Z");

function isoMinusSeconds(s: number): string {
  return new Date(NOW.getTime() - s * 1000).toISOString();
}

describe("toRelativeKorean", () => {
  it("under 60s returns 방금", () => {
    expect(toRelativeKorean(isoMinusSeconds(30), NOW)).toBe("방금");
  });

  it("exactly 60s returns 1분 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(60), NOW)).toBe("1분 전");
  });

  it("59 minutes returns 59분 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(59 * 60), NOW)).toBe("59분 전");
  });

  it("60 minutes returns 1시간 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(60 * 60), NOW)).toBe("1시간 전");
  });

  it("23 hours returns 23시간 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(23 * 3600), NOW)).toBe("23시간 전");
  });

  it("24 hours returns 1일 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(24 * 3600), NOW)).toBe("1일 전");
  });

  it("6 days returns 6일 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(6 * 86400), NOW)).toBe("6일 전");
  });

  it("7 days returns 1주 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(7 * 86400), NOW)).toBe("1주 전");
  });

  it("29 days returns 4주 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(29 * 86400), NOW)).toBe("4주 전");
  });

  it("30 days returns 30일 이상 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(30 * 86400), NOW)).toBe("30일 이상 전");
  });

  it("100 days returns 30일 이상 전", () => {
    expect(toRelativeKorean(isoMinusSeconds(100 * 86400), NOW)).toBe("30일 이상 전");
  });

  it("invalid iso falls back to 방금", () => {
    expect(toRelativeKorean("not-an-iso", NOW)).toBe("방금");
  });

  it("future timestamp returns 방금", () => {
    const future = new Date(NOW.getTime() + 60 * 1000).toISOString();
    expect(toRelativeKorean(future, NOW)).toBe("방금");
  });
});
