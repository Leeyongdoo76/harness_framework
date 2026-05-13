import type { VideoMeta } from "@/types/videoMeta";
import { getStore } from "./storage";

export type CachedMeta = {
  schemaVersion: 1;
  fetchedAt: string;
  videoMeta: VideoMeta;
};

const PREFIX = "videometa:";
const SCHEMA_VERSION = 1 as const;
const TTL_MS = 60 * 60 * 1000;

function isCachedMeta(value: unknown): value is CachedMeta {
  if (typeof value !== "object" || value === null) return false;
  if (!("schemaVersion" in value) || !("fetchedAt" in value) || !("videoMeta" in value)) {
    return false;
  }
  if (typeof value.fetchedAt !== "string") return false;
  return true;
}

function isQuotaError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  if ("name" in e && e.name === "QuotaExceededError") return true;
  if ("code" in e && (e.code === 22 || e.code === 1014)) return true;
  return false;
}

export function getMeta(videoId: string): VideoMeta | null {
  const store = getStore();
  const key = PREFIX + videoId;
  const raw = store.get(key);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    store.remove(key);
    return null;
  }

  if (!isCachedMeta(parsed)) {
    store.remove(key);
    return null;
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    store.remove(key);
    return null;
  }
  const fetchedTs = new Date(parsed.fetchedAt).getTime();
  if (!Number.isFinite(fetchedTs) || Date.now() - fetchedTs > TTL_MS) {
    store.remove(key);
    return null;
  }
  return parsed.videoMeta;
}

export function setMeta(videoId: string, videoMeta: VideoMeta): void {
  const store = getStore();
  const payload: CachedMeta = {
    schemaVersion: SCHEMA_VERSION,
    fetchedAt: new Date().toISOString(),
    videoMeta,
  };
  try {
    store.set(PREFIX + videoId, JSON.stringify(payload));
  } catch (e) {
    if (isQuotaError(e)) return;
    // 메타 캐시는 실패해도 분석 흐름에는 영향 없으므로 silent.
  }
}
