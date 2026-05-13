import type { Report } from "@/types/report";

const PHONE_RE = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const PHONE_MASK = "***-****-****";
const EMAIL_MASK = "***@***";

export function maskPII(text: string): string {
  return text.replace(EMAIL_RE, EMAIL_MASK).replace(PHONE_RE, PHONE_MASK);
}

export function maskPIIInReport(report: Report): Report {
  return {
    ...report,
    summary: maskPII(report.summary),
    strengths: report.strengths.map((s) => ({
      point: maskPII(s.point),
      evidence: s.evidence.map(maskPII),
    })),
    improvements: report.improvements.map((i) => ({
      point: maskPII(i.point),
      evidence: i.evidence.map(maskPII),
    })),
    notableComments: report.notableComments.map((c) => ({
      ...c,
      text: maskPII(c.text),
    })),
  };
}
