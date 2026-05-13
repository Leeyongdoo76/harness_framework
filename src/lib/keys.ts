import { useCallback, useSyncExternalStore } from "react";
import { getStore } from "./storage";

export type ApiKeys = { youtube: string; anthropic: string };

const YOUTUBE_KEY = "keys:youtube";
const ANTHROPIC_KEY = "keys:anthropic";
const CHANGE_EVENT = "change";

const emitter = new EventTarget();

function readKeys(): ApiKeys | null {
  const store = getStore();
  const youtube = store.get(YOUTUBE_KEY);
  const anthropic = store.get(ANTHROPIC_KEY);
  if (youtube === null || anthropic === null) return null;
  if (youtube === "" || anthropic === "") return null;
  return { youtube, anthropic };
}

let snapshot: ApiKeys | null = null;
let snapshotInitialized = false;

function getSnapshot(): ApiKeys | null {
  if (!snapshotInitialized) {
    snapshot = readKeys();
    snapshotInitialized = true;
  }
  return snapshot;
}

function refreshSnapshot(): void {
  snapshot = readKeys();
  snapshotInitialized = true;
  emitter.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void): () => void {
  emitter.addEventListener(CHANGE_EVENT, listener);
  return () => emitter.removeEventListener(CHANGE_EVENT, listener);
}

export function loadKeys(): ApiKeys | null {
  return readKeys();
}

export function saveKeys(keys: ApiKeys): void {
  const youtube = keys.youtube.trim();
  const anthropic = keys.anthropic.trim();
  if (youtube === "" || anthropic === "") {
    throw new Error("saveKeys: both keys must be non-empty");
  }
  const store = getStore();
  store.set(YOUTUBE_KEY, youtube);
  store.set(ANTHROPIC_KEY, anthropic);
  refreshSnapshot();
}

export function clearKeys(): void {
  const store = getStore();
  store.remove(YOUTUBE_KEY);
  store.remove(ANTHROPIC_KEY);
  refreshSnapshot();
}

export function maskKey(key: string): string {
  if (key.length < 8) {
    return "•".repeat(key.length);
  }
  return "••••••••" + key.slice(-4);
}

export function useApiKeys(): {
  keys: ApiKeys | null;
  save: (keys: ApiKeys) => void;
  clear: () => void;
} {
  const keys = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const save = useCallback((next: ApiKeys) => {
    saveKeys(next);
  }, []);
  const clear = useCallback(() => {
    clearKeys();
  }, []);
  return { keys, save, clear };
}

export function __resetForTests(): void {
  snapshot = null;
  snapshotInitialized = false;
}
