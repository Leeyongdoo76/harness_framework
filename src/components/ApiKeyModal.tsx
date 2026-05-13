import { useId, useRef, useState } from "react";
import { t } from "@/lib/copy";
import { maskKey } from "@/lib/keys";
import { useFocusTrap } from "@/lib/focusTrap";
import ConfirmDialog from "./ConfirmDialog";

const YOUTUBE_GUIDE_URL =
  "https://console.cloud.google.com/apis/library/youtube.googleapis.com";
const ANTHROPIC_GUIDE_URL = "https://console.anthropic.com/settings/keys";

type Props = {
  mode: "first" | "edit";
  currentKeys?: { youtube: string; anthropic: string };
  onSave: (keys: { youtube: string; anthropic: string }) => void;
  onClose?: () => void;
  onClearAll: () => void;
};

const INPUT_BASE =
  "w-full rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] min-h-[44px]";

const TEXT_BUTTON =
  "inline-flex items-center justify-center min-h-[44px] px-3 text-xs text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-lg bg-white text-black hover:bg-neutral-200 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

const DANGER_BUTTON =
  "inline-flex items-center justify-center rounded-lg bg-[#ef4444] text-white hover:bg-[#dc2626] px-4 py-2 text-sm font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

const LINK_STYLE =
  "inline-flex items-center gap-1 text-neutral-300 hover:text-white underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded";

export default function ApiKeyModal({
  mode,
  currentKeys,
  onSave,
  onClose,
  onClearAll,
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const ytId = useId();
  const anthId = useId();

  const [youtube, setYoutube] = useState<string>(currentKeys?.youtube ?? "");
  const [anthropic, setAnthropic] = useState<string>(currentKeys?.anthropic ?? "");
  const [showYoutube, setShowYoutube] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const allowEscape = mode === "edit";
  useFocusTrap(ref, !confirmOpen, {
    allowEscape,
    ...(allowEscape && onClose !== undefined ? { onEscape: onClose } : {}),
  });

  const saveDisabled = youtube.trim() === "" || anthropic.trim() === "";

  const handleSave = (): void => {
    if (saveDisabled) return;
    onSave({ youtube: youtube.trim(), anthropic: anthropic.trim() });
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (mode === "first") return;
    if (e.target === e.currentTarget) onClose?.();
  };

  const handleConfirmClear = (): void => {
    setConfirmOpen(false);
    onClearAll();
  };

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard close handled by focus trap (ESC, edit mode only) */}
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8"
        onClick={handleBackdropClick}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full max-w-lg rounded-lg bg-[#141414] border border-neutral-800 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        >
          <div className="space-y-2">
            <h2 id={titleId} className="text-lg font-medium text-white">
              {t("keys.modalTitle")}
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {t("keys.modalIntro")}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor={ytId} className="block text-sm font-medium text-neutral-300">
              {t("keys.youtubeLabel")}
            </label>
            <div className="flex gap-2">
              <input
                id={ytId}
                type={showYoutube ? "text" : "password"}
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder={t("keys.youtubePlaceholder")}
                autoComplete="off"
                spellCheck={false}
                className={INPUT_BASE}
              />
              <button
                type="button"
                onClick={() => setShowYoutube((s) => !s)}
                className={TEXT_BUTTON}
              >
                {showYoutube ? t("keys.hideToggle") : t("keys.showToggle")}
              </button>
            </div>
            {mode === "edit" && currentKeys !== undefined && currentKeys.youtube !== "" && (
              <p className="text-xs text-neutral-500">
                {maskKey(currentKeys.youtube)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor={anthId} className="block text-sm font-medium text-neutral-300">
              {t("keys.anthropicLabel")}
            </label>
            <div className="flex gap-2">
              <input
                id={anthId}
                type={showAnthropic ? "text" : "password"}
                value={anthropic}
                onChange={(e) => setAnthropic(e.target.value)}
                placeholder={t("keys.anthropicPlaceholder")}
                autoComplete="off"
                spellCheck={false}
                className={INPUT_BASE}
              />
              <button
                type="button"
                onClick={() => setShowAnthropic((s) => !s)}
                className={TEXT_BUTTON}
              >
                {showAnthropic ? t("keys.hideToggle") : t("keys.showToggle")}
              </button>
            </div>
            {mode === "edit" && currentKeys !== undefined && currentKeys.anthropic !== "" && (
              <p className="text-xs text-neutral-500">
                {maskKey(currentKeys.anthropic)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setGuideOpen((g) => !g)}
              aria-expanded={guideOpen}
              className={TEXT_BUTTON + " self-start"}
            >
              {guideOpen ? t("keys.guideToggleOpen") : t("keys.guideToggleClosed")}
            </button>
            {guideOpen && (
              <div className="space-y-3 text-sm text-neutral-300 border border-neutral-800 rounded-lg p-4">
                <div className="space-y-1">
                  <p className="font-medium text-white">{t("keys.youtubeLabel")}</p>
                  <p className="leading-relaxed">{t("keys.youtubeGuide")}</p>
                  <a
                    href={YOUTUBE_GUIDE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_STYLE + " text-xs"}
                  >
                    {t("keys.youtubeGuideLink")}
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-white">{t("keys.anthropicLabel")}</p>
                  <p className="leading-relaxed">{t("keys.anthropicGuide")}</p>
                  <a
                    href={ANTHROPIC_GUIDE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_STYLE + " text-xs"}
                  >
                    {t("keys.anthropicGuideLink")}
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className={DANGER_BUTTON}
            >
              {t("keys.deleteAll")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveDisabled}
              className={PRIMARY_BUTTON}
            >
              {t("keys.save")}
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title={t("keys.deleteConfirmTitle")}
          body={t("keys.deleteConfirmBody")}
          confirmLabel={t("keys.deleteConfirmAction")}
          cancelLabel={t("keys.deleteCancel")}
          onConfirm={handleConfirmClear}
          onCancel={() => setConfirmOpen(false)}
          variant="danger"
        />
      )}
    </>
  );
}
