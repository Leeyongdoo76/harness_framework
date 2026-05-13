export interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

const PROBE_KEY = "__probe__";

let cachedStore: KVStore | null = null;
let usingFallback = false;
let warned = false;

function makeLocalStorageAdapter(): KVStore {
  return {
    get(key) {
      return localStorage.getItem(key);
    },
    set(key, value) {
      localStorage.setItem(key, value);
    },
    remove(key) {
      localStorage.removeItem(key);
    },
    keys() {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    },
  };
}

function makeMemoryAdapter(): KVStore {
  const map = new Map<string, string>();
  return {
    get(key) {
      const v = map.get(key);
      return v === undefined ? null : v;
    },
    set(key, value) {
      map.set(key, value);
    },
    remove(key) {
      map.delete(key);
    },
    keys() {
      return Array.from(map.keys());
    },
  };
}

function detectStore(): KVStore {
  try {
    localStorage.setItem(PROBE_KEY, "1");
    localStorage.removeItem(PROBE_KEY);
    usingFallback = false;
    return makeLocalStorageAdapter();
  } catch {
    usingFallback = true;
    if (!warned) {
      warned = true;
      console.warn("storage: localStorage unavailable, using in-memory fallback");
    }
    return makeMemoryAdapter();
  }
}

export function getStore(): KVStore {
  if (cachedStore === null) {
    cachedStore = detectStore();
  }
  return cachedStore;
}

export function isUsingFallback(): boolean {
  return usingFallback;
}

export function __resetForTests(): void {
  cachedStore = null;
  usingFallback = false;
  warned = false;
}
