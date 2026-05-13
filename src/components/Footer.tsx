import { t } from "@/lib/copy";

const SOURCE_URL = "https://github.com";

export default function Footer(): JSX.Element {
  return (
    <footer className="max-w-5xl mx-auto px-6 pt-10 pb-[env(safe-area-inset-bottom)] space-y-2 text-xs text-neutral-500">
      <p>{t("footer.disclaimer")}</p>
      <p>{t("footer.privacy")}</p>
      <p>
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded"
        >
          {t("footer.source")}
          <span aria-hidden="true">↗</span>
        </a>
      </p>
    </footer>
  );
}
