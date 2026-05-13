import { useEffect, useRef } from "react";
import { t } from "@/lib/copy";
import type { CopyKey } from "@/types/copy";
import type { AppError } from "@/types/errors";

export type ErrorBannerAction = "retry" | "editUrl" | "openSettings" | "refreshPage";

type Props = {
  error: AppError;
  actions: ErrorBannerAction[];
  onAction: (action: ErrorBannerAction) => void;
};

const ACTION_KEY: Record<ErrorBannerAction, CopyKey> = {
  retry: "error.retry",
  editUrl: "error.editUrl",
  openSettings: "error.openSettings",
  refreshPage: "error.refreshPage",
};

const TEXT_BUTTON =
  "inline-flex items-center justify-center min-h-[44px] px-3 text-sm text-neutral-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded-lg";

export default function ErrorBanner({ error, actions, onAction }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      className="max-w-5xl mx-auto px-4 py-3 my-4 border-l-4 border-[#ef4444] bg-[#ef4444]/10 text-neutral-200 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between focus-visible:outline-none"
    >
      <p className="text-sm">{error.userMessage}</p>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              className={TEXT_BUTTON}
            >
              {t(ACTION_KEY[action])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
