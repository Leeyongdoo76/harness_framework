import { useState } from "react";
import { t } from "@/lib/copy";
import type { NotableComment } from "@/types/report";

type Props = { items: NotableComment[] };

const TEXT_BUTTON =
  "text-xs text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded";

const MAX_LINE_LENGTH_HINT = 120;

function Item({ item }: { item: NotableComment }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const author = item.author.length > 0 ? item.author : "익명";
  const isLong = item.text.length > MAX_LINE_LENGTH_HINT;
  return (
    <li className="space-y-1">
      <p className="text-xs text-neutral-500">
        <span>{author}</span>
        <span className="mx-1">·</span>
        <span>{t("card.likesFormat", { count: item.likes })}</span>
      </p>
      <blockquote
        className={`text-sm text-neutral-300 italic border-l-2 border-neutral-700 pl-3 ${
          isLong && !expanded ? "line-clamp-3" : ""
        }`}
      >
        {item.text}
      </blockquote>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={TEXT_BUTTON}
        >
          {expanded ? t("card.evidenceLess") : t("card.evidenceMore")}
        </button>
      )}
    </li>
  );
}

export default function NotableCommentsCard({ items }: Props): JSX.Element {
  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-6 fade-in">
      <h3 className="text-sm font-medium text-neutral-400">{t("card.notableComments")}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">{t("card.emptyNotable")}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {items.map((item, index) => (
            <Item key={`${item.author}-${item.likes}-${index}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
