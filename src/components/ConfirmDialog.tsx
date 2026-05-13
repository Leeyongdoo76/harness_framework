import { useId, useRef } from "react";
import { useFocusTrap } from "@/lib/focusTrap";

type Props = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "default" | "danger";
};

const DEFAULT_CONFIRM =
  "inline-flex items-center justify-center rounded-lg bg-white text-black hover:bg-neutral-200 px-4 py-2 text-sm font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

const DANGER_CONFIRM =
  "inline-flex items-center justify-center rounded-lg bg-[#ef4444] text-white hover:bg-[#dc2626] px-4 py-2 text-sm font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

const CANCEL_BUTTON =
  "inline-flex items-center justify-center min-h-[44px] px-4 py-2 text-sm text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded-lg";

export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = "default",
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, true, { allowEscape: true, onEscape: onCancel });

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard close handled by focus trap (ESC) */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg bg-[#141414] border border-neutral-800 p-6 space-y-4"
      >
        <h2 id={titleId} className="text-lg font-medium text-white">
          {title}
        </h2>
        <p className="text-sm text-neutral-300 leading-relaxed">{body}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={CANCEL_BUTTON}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={variant === "danger" ? DANGER_CONFIRM : DEFAULT_CONFIRM}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
