import { describe, expect, it } from "vitest";
import type { Report } from "@/types/report";
import { maskPII, maskPIIInReport } from "./pii";

describe("maskPII", () => {
  it("masks plain Korean mobile number", () => {
    expect(maskPII("연락처 010-1234-5678 입니다")).toBe("연락처 ***-****-**** 입니다");
  });

  it("masks digits-only phone-like sequence", () => {
    expect(maskPII("문의: 01012345678")).toContain("***-****-****");
    expect(maskPII("문의: 01012345678")).not.toMatch(/\d{10}/);
  });

  it("masks phone with country prefix", () => {
    expect(maskPII("call +82 10 1234 5678 thanks")).toContain("***-****-****");
  });

  it("masks email", () => {
    expect(maskPII("이메일: user@example.com")).toBe("이메일: ***@***");
  });

  it("masks email with subdomain and plus", () => {
    expect(maskPII("hi test+tag@mail.co.kr")).toBe("hi ***@***");
  });

  it("preserves text without PII", () => {
    expect(maskPII("This video is great")).toBe("This video is great");
  });

  it("masks both in same string", () => {
    const out = maskPII("연락 010-1234-5678 / a@b.com");
    expect(out).toContain("***-****-****");
    expect(out).toContain("***@***");
  });

  it("does not strip surrounding text", () => {
    const out = maskPII("강점: 친절한 응답 (예: a@b.com)");
    expect(out.startsWith("강점: 친절한 응답 (예: ")).toBe(true);
    expect(out.endsWith(")")).toBe(true);
  });
});

describe("maskPIIInReport", () => {
  function makeReport(overrides: Partial<Report> = {}): Report {
    return {
      summary: "default",
      detectedLanguage: "ko",
      sentiment: { positive: 50, neutral: 30, negative: 20 },
      strengths: [],
      improvements: [],
      keywords: [],
      notableComments: [],
      ...overrides,
    };
  }

  it("masks summary, strengths, improvements, notableComments text", () => {
    const r = makeReport({
      summary: "문의 010-1234-5678",
      strengths: [{ point: "친절 a@b.com", evidence: ["evidence 010-9876-5432"] }],
      improvements: [{ point: "메일 test@x.co", evidence: ["010-0000-0000"] }],
      notableComments: [
        { text: "010-1111-2222 댓글", likes: 5, author: "익명" },
      ],
    });

    const out = maskPIIInReport(r);
    expect(out.summary).toBe("문의 ***-****-****");
    expect(out.strengths[0]?.point).toBe("친절 ***@***");
    expect(out.strengths[0]?.evidence[0]).toBe("evidence ***-****-****");
    expect(out.improvements[0]?.point).toBe("메일 ***@***");
    expect(out.improvements[0]?.evidence[0]).toBe("***-****-****");
    expect(out.notableComments[0]?.text).toBe("***-****-**** 댓글");
  });

  it("does not mask keywords.term or notableComments.author", () => {
    const r = makeReport({
      keywords: [{ term: "010-1234-5678", count: 3, sentiment: "neu" }],
      notableComments: [
        { text: "ok", likes: 1, author: "010-1234-5678" },
      ],
    });
    const out = maskPIIInReport(r);
    expect(out.keywords[0]?.term).toBe("010-1234-5678");
    expect(out.notableComments[0]?.author).toBe("010-1234-5678");
  });
});
