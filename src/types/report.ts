import { z } from "zod";

export const SentimentLabelSchema = z.enum(["pos", "neu", "neg"]);
export type SentimentLabel = z.infer<typeof SentimentLabelSchema>;

export const SentimentSchema = z
  .object({
    positive: z.number().min(0).max(100),
    neutral: z.number().min(0).max(100),
    negative: z.number().min(0).max(100),
  })
  .refine((s) => Math.abs(s.positive + s.neutral + s.negative - 100) <= 1, {
    message: "sentiment 합이 100이 아닙니다 (오차 ±1 허용)",
  });
export type Sentiment = z.infer<typeof SentimentSchema>;

export const StrengthSchema = z.object({
  point: z.string().min(1),
  evidence: z.array(z.string()),
});
export type Strength = z.infer<typeof StrengthSchema>;

export const ImprovementSchema = StrengthSchema;
export type Improvement = z.infer<typeof ImprovementSchema>;

export const KeywordSchema = z.object({
  term: z.string().min(1),
  count: z.number().int().nonnegative(),
  sentiment: SentimentLabelSchema,
});
export type Keyword = z.infer<typeof KeywordSchema>;

export const NotableCommentSchema = z.object({
  text: z.string().min(1),
  likes: z.number().int().nonnegative(),
  author: z.string(),
});
export type NotableComment = z.infer<typeof NotableCommentSchema>;

export const ReportSchema = z.object({
  summary: z.string().min(1),
  detectedLanguage: z.string().min(2),
  sentiment: SentimentSchema,
  strengths: z.array(StrengthSchema).max(5),
  improvements: z.array(ImprovementSchema).max(5),
  keywords: z.array(KeywordSchema).max(15),
  notableComments: z.array(NotableCommentSchema).max(10),
});
export type Report = z.infer<typeof ReportSchema>;
