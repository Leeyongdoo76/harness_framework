import { t } from "@/lib/copy";

type Props = {
  phase: "fetching" | "analyzing";
  onCancel: () => void;
};

const TEXT_BUTTON =
  "inline-flex items-center justify-center min-h-[44px] px-4 text-sm text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded-lg";

export default function ProgressIndicator({ phase, onCancel }: Props): JSX.Element {
  const phaseText =
    phase === "fetching" ? t("progress.fetching") : t("progress.analyzing");

  return (
    <section
      aria-label={phaseText}
      className="max-w-5xl mx-auto px-6 py-10 flex flex-col items-center justify-center gap-3 text-center"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="text-neutral-400 animate-spin"
        aria-hidden="true"
      >
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
      <p className="text-sm text-neutral-300">{phaseText}</p>
      <p className="text-xs text-neutral-500">{t("progress.estimate")}</p>
      <button type="button" onClick={onCancel} className={TEXT_BUTTON}>
        {t("progress.cancel")}
      </button>
    </section>
  );
}
