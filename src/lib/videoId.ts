const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set<string>([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);

const REJECTED_PATH_PREFIXES = ["/channel/", "/@", "/user/", "/c/"];

export function parseVideoId(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();

  if (host === "youtu.be") {
    const segment = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    return VIDEO_ID_RE.test(segment) ? segment : null;
  }

  if (!YOUTUBE_HOSTS.has(host)) return null;

  const path = url.pathname;

  if (path === "/playlist" || path.startsWith("/playlist/")) return null;
  for (const prefix of REJECTED_PATH_PREFIXES) {
    if (path.startsWith(prefix)) return null;
  }

  if (path === "/watch" || path === "/watch/") {
    const v = url.searchParams.get("v") ?? "";
    return VIDEO_ID_RE.test(v) ? v : null;
  }

  const match = path.match(/^\/(?:shorts|embed|v|live)\/([^/?#]+)/);
  if (match && match[1]) {
    return VIDEO_ID_RE.test(match[1]) ? match[1] : null;
  }

  return null;
}
