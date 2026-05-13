import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { t } from "@/lib/copy";
import type { Sentiment } from "@/types/report";

type Props = { sentiment: Sentiment };

type Slice = { name: string; value: number; color: string };

const COLOR_POSITIVE = "#22c55e";
const COLOR_NEUTRAL = "#525252";
const COLOR_NEGATIVE = "#ef4444";

function pickDominant(sentiment: Sentiment): { label: string; value: number } {
  const positive = sentiment.positive;
  const neutral = sentiment.neutral;
  const negative = sentiment.negative;
  const max = Math.max(positive, neutral, negative);
  if (positive === max) return { label: t("sentiment.positive"), value: positive };
  if (negative === max) return { label: t("sentiment.negative"), value: negative };
  return { label: t("sentiment.neutral"), value: neutral };
}

function roundPercent(n: number): number {
  return Math.round(n);
}

export default function SentimentChart({ sentiment }: Props): JSX.Element {
  const data: Slice[] = [
    { name: t("sentiment.positive"), value: sentiment.positive, color: COLOR_POSITIVE },
    { name: t("sentiment.neutral"), value: sentiment.neutral, color: COLOR_NEUTRAL },
    { name: t("sentiment.negative"), value: sentiment.negative, color: COLOR_NEGATIVE },
  ];

  const dominant = pickDominant(sentiment);

  const ariaLabel = `감정 분포: 긍정 ${roundPercent(sentiment.positive)}%, 중립 ${roundPercent(
    sentiment.neutral,
  )}%, 부정 ${roundPercent(sentiment.negative)}%`;

  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-6 fade-in">
      <h3 className="text-sm font-medium text-neutral-400">{t("card.sentiment")}</h3>
      <div className="mt-3 flex flex-col sm:flex-row items-center gap-6">
        <div
          role="img"
          aria-label={ariaLabel}
          className="relative w-[200px] h-[200px] flex items-center justify-center"
        >
          <PieChart width={200} height={200}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="80%"
              isAnimationActive={false}
              stroke="#0a0a0a"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: "#141414",
                border: "1px solid #262626",
                borderRadius: "0.5rem",
                color: "#e5e5e5",
                fontSize: "0.75rem",
              }}
              formatter={(value: number, name: string) => [`${roundPercent(value)}%`, name]}
            />
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-neutral-400">{dominant.label}</span>
            <span className="text-2xl font-semibold text-white">
              {roundPercent(dominant.value)}%
            </span>
          </div>
        </div>
        <ul className="space-y-2 text-sm" aria-hidden="true">
          {data.map((slice) => (
            <li key={slice.name} className="flex items-center gap-2 text-neutral-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span>
                {slice.name} {roundPercent(slice.value)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="sr-only">
        {data.map((slice) => (
          <li key={slice.name}>
            {slice.name} {roundPercent(slice.value)}%
          </li>
        ))}
      </ul>
    </section>
  );
}
