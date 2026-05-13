import { t } from "@/lib/copy";

type Props = { summary: string };

export default function SummaryCard({ summary }: Props): JSX.Element {
  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-6 fade-in">
      <h3 className="text-sm font-medium text-neutral-400">{t("card.summary")}</h3>
      <p className="mt-3 text-sm text-neutral-300 leading-relaxed">{summary}</p>
    </section>
  );
}
