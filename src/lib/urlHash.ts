import { useCallback, useEffect, useState } from "react";

const HASH_RE = /^#v=([A-Za-z0-9_-]{11})$/;

export function parseHashVideoId(hash: string): string | null {
  const m = HASH_RE.exec(hash);
  return m === null ? null : (m[1] ?? null);
}

export function buildHash(videoId: string): string {
  return "#v=" + videoId;
}

export function useUrlHash(): {
  videoId: string | null;
  setVideoId: (id: string | null) => void;
} {
  const [videoId, setVideoIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : parseHashVideoId(window.location.hash),
  );

  useEffect(() => {
    const handler = (): void => {
      setVideoIdState(parseHashVideoId(window.location.hash));
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const setVideoId = useCallback((id: string | null) => {
    if (id === null) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    } else {
      window.history.replaceState(null, "", buildHash(id));
    }
    setVideoIdState(id);
  }, []);

  return { videoId, setVideoId };
}
