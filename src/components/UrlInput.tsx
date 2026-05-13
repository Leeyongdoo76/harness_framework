import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { t } from "@/lib/copy";
import { parseVideoId } from "@/lib/videoId";

type Props = {
  value: string;
  onChange: (url: string) => void;
  onSubmit: (videoId: string) => void;
  disabled?: boolean;
};

type ErrorKind =
  | "invalidDomain"
  | "invalidVideo"
  | "playlist"
  | "channel"
  | null;

const YOUTUBE_HOSTS = new Set<string>([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

const CHANNEL_PATH_PREFIXES = ["/channel/", "/@", "/user/", "/c/"];

function classify(raw: string): { kind: "ok"; videoId: string } | { kind: "error"; error: Exclude<ErrorKind, null> } | { kind: "empty" } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: "empty" };

  let url: URL | null = null;
  try {
    url = new URL(trimmed);
  } catch {
    url = null;
  }

  if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return { kind: "error", error: "invalidVideo" };
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return { kind: "error", error: "invalidDomain" };
  }

  const path = url.pathname;
  if (path === "/playlist" || path.startsWith("/playlist/")) {
    return { kind: "error", error: "playlist" };
  }
  for (const prefix of CHANNEL_PATH_PREFIXES) {
    if (path.startsWith(prefix)) {
      return { kind: "error", error: "channel" };
    }
  }

  const videoId = parseVideoId(trimmed);
  if (videoId === null) {
    return { kind: "error", error: "invalidVideo" };
  }
  return { kind: "ok", videoId };
}

function errorMessage(kind: Exclude<ErrorKind, null>): string {
  switch (kind) {
    case "invalidDomain":
      return t("url.errorInvalidDomain");
    case "invalidVideo":
      return t("url.errorInvalidVideo");
    case "playlist":
      return t("url.errorPlaylist");
    case "channel":
      return t("url.errorChannel");
  }
}

export default function UrlInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: Props): JSX.Element {
  const inputId = useId();
  const errorId = useId();
  const [error, setError] = useState<ErrorKind>(null);

  const tryTrigger = (): void => {
    const result = classify(value);
    if (result.kind === "empty") {
      setError(null);
      return;
    }
    if (result.kind === "error") {
      setError(result.error);
      return;
    }
    setError(null);
    onSubmit(result.videoId);
  };

  const handleBlur = (): void => {
    if (disabled === true) return;
    tryTrigger();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (disabled === true) return;
    if (event.key === "Enter") {
      event.preventDefault();
      tryTrigger();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (error !== null) setError(null);
    onChange(event.target.value);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-neutral-300">
        {t("url.label")}
      </label>
      <input
        id={inputId}
        type="url"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled === true}
        placeholder={t("url.placeholder")}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {error !== null && (
        <p id={errorId} role="alert" className="text-xs text-[#ef4444]">
          {errorMessage(error)}
        </p>
      )}
    </div>
  );
}
