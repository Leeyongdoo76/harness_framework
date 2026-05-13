import { getStore } from "./storage";

const PREFIXES: readonly string[] = ["keys:", "report:", "videometa:", "flag:"];

export function clearAll(): void {
  const store = getStore();
  for (const key of store.keys()) {
    if (PREFIXES.some((p) => key.startsWith(p))) {
      store.remove(key);
    }
  }
}
