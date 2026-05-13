import { StorageError } from "@/types/errors";
import type { Report } from "@/types/report";
import type { VideoMeta } from "@/types/videoMeta";
import { getStore } from "./storage";

export type CachedEntry = {
  schemaVersion: 1;
  createdAt: string;
  videoMeta?: VideoMeta;
  report: Report;
  commentCount: number;
  truncatedCount?: number;
};

const PREFIX = "report:";
const SCHEMA_VERSION = 1 as const;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isQuotaError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  if ("name" in e && e.name === "QuotaExceededError") return true;
  if ("code" in e && (e.code === 22 || e.code === 1014)) return true;
  return false;
}

function isCachedEntry(value: unknown): value is CachedEntry {
  if (typeof value !== "object" || value === null) return false;
  if (!("schemaVersion" in value) || !("createdAt" in value)) return false;
  if (!("report" in value) || !("commentCount" in value)) return false;
  if (typeof value.createdAt !== "string") return false;
  if (typeof value.commentCount !== "number") return false;
  return true;
}

export function getReport(videoId: string): CachedEntry | null {
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

  if (!isCachedEntry(parsed)) {
    store.remove(key);
    return null;
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    store.remove(key);
    return null;
  }
  const created = new Date(parsed.createdAt).getTime();
  if (!Number.isFinite(created) || Date.now() - created > TTL_MS) {
    store.remove(key);
    return null;
  }
  return parsed;
}

type SetReportInput = Omit<CachedEntry, "schemaVersion" | "createdAt"> & {
  createdAt?: string;
};

function buildPayload(input: SetReportInput): CachedEntry {
  const payload: CachedEntry = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    report: input.report,
    commentCount: input.commentCount,
  };
  if (input.videoMeta !== undefined) payload.videoMeta = input.videoMeta;
  if (input.truncatedCount !== undefined) payload.truncatedCount = input.truncatedCount;
  return payload;
}

function findOldestReportKey(store: ReturnType<typeof getStore>, excludeKey: string): string | null {
  let oldestKey: string | null = null;
  let oldestTs = Number.POSITIVE_INFINITY;
  for (const k of store.keys()) {
    if (!k.startsWith(PREFIX) || k === excludeKey) continue;
    const raw = store.get(k);
    if (raw === null) continue;
    let ts = 0;
    try {
      const v: unknown = JSON.parse(raw);
      if (typeof v === "object" && v !== null && "createdAt" in v && typeof v.createdAt === "string") {
        const parsedTs = new Date(v.createdAt).getTime();
        ts = Number.isFinite(parsedTs) ? parsedTs : 0;
      }
    } catch {
      ts = 0;
    }
    if (ts < oldestTs) {
      oldestTs = ts;
      oldestKey = k;
    }
  }
  return oldestKey;
}

export function setReport(videoId: string, input: SetReportInput): void {
  const store = getStore();
  const key = PREFIX + videoId;
  const payload = buildPayload(input);
  const json = JSON.stringify(payload);

  try {
    store.set(key, json);
    return;
  } catch (e) {
    if (!isQuotaError(e)) {
      throw new StorageError("storage write failed", e);
    }
    const oldest = findOldestReportKey(store, key);
    if (oldest === null) {
      throw new StorageError("storage quota exceeded with no evictable entries", e);
    }
    store.remove(oldest);
    try {
      store.set(key, json);
    } catch (e2) {
      throw new StorageError("storage quota exceeded after eviction", e2);
    }
  }
}
