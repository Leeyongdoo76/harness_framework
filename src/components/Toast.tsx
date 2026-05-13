import { useEffect } from "react";
import { t } from "@/lib/copy";
import type { CopyKey } from "@/types/copy";

const DISMISS_MS = 4000;

type Props = {
  messageKey: CopyKey | null;
  onDismiss: () => void;
};

export default function Toast({ messageKey, onDismiss }: Props): JSX.Element | null {
  useEffect(() => {
    if (messageKey === null) return;
    const id = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(id);
  }, [messageKey, onDismiss]);

  if (messageKey === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fade-in fixed bottom-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-neutral-200 shadow-lg"
    >
      {t(messageKey)}
    </div>
  );
}
