import { t } from "@/lib/copy";
import type { Keyword, SentimentLabel } from "@/types/report";

type Props = { keywords: Keyword[] };

const SENTIMENT_CLASS: Record<SentimentLabel, string> = {
  pos: "bg-[#22c55e]/15 text-[#22c55e]",
  neg: "bg-[#ef4444]/15 text-[#ef4444]",
  neu: "bg-neutral-800 text-neutral-300",
};

const SENTIMENT_KOREAN: Record<SentimentLabel, string> = {
  pos: "긍정",
  neg: "부정",
  neu: "중립",
};

export default function KeywordsCard({ keywords }: Props): JSX.Element {
  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-6 fade-in">
      <h3 className="text-sm font-medium text-neutral-400">{t("card.keywords")}</h3>
      {keywords.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">{t("card.emptyKeywords")}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {keywords.map((k) => {
            const sentimentLabel = SENTIMENT_KOREAN[k.sentiment];
            const ariaLabel = `${sentimentLabel} 키워드 ${k.term}, ${k.count}건`;
            return (
              <li key={`${k.term}-${k.sentiment}`}>
                <span
                  role="img"
                  aria-label={ariaLabel}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${SENTIMENT_CLASS[k.sentiment]}`}
                >
                  <span>{k.term}</span>
                  <span className="ml-1 bg-neutral-900 px-2 py-0.5 rounded-full text-neutral-300">
                    {k.count}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
