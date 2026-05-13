import { describe, expect, it } from "vitest";
import { ReportSchema, SentimentSchema } from "./report";

const validReport = {
  summary: "전체적으로 긍정적인 반응이 많습니다.",
  detectedLanguage: "ko",
  sentiment: { positive: 70, neutral: 20, negative: 10 },
  strengths: [{ point: "편집이 좋다", evidence: ["편집이 깔끔해요"] }],
  improvements: [{ point: "음향 개선 필요", evidence: ["소리가 작아요"] }],
  keywords: [{ term: "편집", count: 12, sentiment: "pos" as const }],
  notableComments: [{ text: "정말 유익했어요", likes: 42, author: "user1" }],
};

describe("SentimentSchema", () => {
  it("정확히 합 100이면 통과", () => {
    expect(
      SentimentSchema.safeParse({ positive: 50, neutral: 30, negative: 20 }).success,
    ).toBe(true);
  });

  it("합 99(±1 허용)이면 통과", () => {
    expect(
      SentimentSchema.safeParse({ positive: 50, neutral: 30, negative: 19 }).success,
    ).toBe(true);
  });

  it("합 101(±1 허용)이면 통과", () => {
    expect(
      SentimentSchema.safeParse({ positive: 50, neutral: 30, negative: 21 }).success,
    ).toBe(true);
  });

  it("합 90이면 실패", () => {
    expect(
      SentimentSchema.safeParse({ positive: 50, neutral: 30, negative: 10 }).success,
    ).toBe(false);
  });

  it("음수면 실패", () => {
    expect(
      SentimentSchema.safeParse({ positive: -10, neutral: 60, negative: 50 }).success,
    ).toBe(false);
  });

  it("100 초과면 실패", () => {
    expect(
      SentimentSchema.safeParse({ positive: 110, neutral: 0, negative: 0 }).success,
    ).toBe(false);
  });
});

describe("ReportSchema", () => {
  it("정상 응답 parse 성공", () => {
    const result = ReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
  });

  it("strengths 6개면 실패 (max 5)", () => {
    const tooMany = {
      ...validReport,
      strengths: Array.from({ length: 6 }, (_, i) => ({
        point: `point${i}`,
        evidence: [],
      })),
    };
    expect(ReportSchema.safeParse(tooMany).success).toBe(false);
  });

  it("summary 누락 시 실패", () => {
    const { summary: _summary, ...rest } = validReport;
    expect(ReportSchema.safeParse(rest).success).toBe(false);
  });

  it("summary 빈 문자열이면 실패", () => {
    expect(
      ReportSchema.safeParse({ ...validReport, summary: "" }).success,
    ).toBe(false);
  });

  it("sentiment 합 90이면 실패", () => {
    const bad = {
      ...validReport,
      sentiment: { positive: 50, neutral: 30, negative: 10 },
    };
    expect(ReportSchema.safeParse(bad).success).toBe(false);
  });

  it("keywords sentiment 라벨 잘못되면 실패", () => {
    const bad = {
      ...validReport,
      keywords: [{ term: "x", count: 1, sentiment: "happy" }],
    };
    expect(ReportSchema.safeParse(bad).success).toBe(false);
  });

  it("빈 배열들 (strengths/improvements/keywords/notableComments) 통과", () => {
    const empty = {
      ...validReport,
      strengths: [],
      improvements: [],
      keywords: [],
      notableComments: [],
    };
    expect(ReportSchema.safeParse(empty).success).toBe(true);
  });

  it("notableComments 11개면 실패 (max 10)", () => {
    const tooMany = {
      ...validReport,
      notableComments: Array.from({ length: 11 }, (_, i) => ({
        text: `t${i}`,
        likes: i,
        author: "a",
      })),
    };
    expect(ReportSchema.safeParse(tooMany).success).toBe(false);
  });
});
