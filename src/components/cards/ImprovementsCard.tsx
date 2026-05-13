import { useState } from "react";
import { t } from "@/lib/copy";
import type { Improvement } from "@/types/report";

type Props = { improvements: Improvement[] };

const TEXT_BUTTON =
  "text-xs text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded";

function Item({ improvement }: { improvement: Improvement }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const evidence = improvement.evidence;
  const visible = expanded ? evidence : evidence.slice(0, 1);
  const hasMore = evidence.length > 1;

  return (
    <li className="space-y-2">
      <h4 className="text-sm font-medium text-white">{improvement.point}</h4>
      {evidence.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-neutral-500">{t("card.evidenceLabel")}</div>
          {visible.map((quote, index) => (
            <blockquote
              key={`${quote}-${index}`}
              className="text-sm text-neutral-300 italic border-l-2 border-neutral-700 pl-3"
            >
              {quote}
            </blockquote>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={TEXT_BUTTON}
            >
              {expanded ? t("card.evidenceLess") : t("card.evidenceMore")}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function ImprovementsCard({ improvements }: Props): JSX.Element {
  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-6 fade-in">
      <h3 className="text-sm font-medium text-neutral-400">{t("card.improvements")}</h3>
      {improvements.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">{t("card.emptyImprovements")}</p>
      ) : (
        <ul className="mt-3 space-y-5">
          {improvements.map((s) => (
            <Item key={s.point} improvement={s} />
          ))}
        </ul>
      )}
    </section>
  );
}
