import { useOnlineStatus } from "@/lib/online";
import { OfflineError } from "@/types/errors";

export default function OfflineBanner(): JSX.Element | null {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 bg-[#f59e0b]/15 text-[#f59e0b] py-2 px-4 text-sm text-center"
    >
      {new OfflineError("offline").userMessage}
    </div>
  );
}
