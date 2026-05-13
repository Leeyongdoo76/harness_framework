import { AbortError } from "@/types/errors";

export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry: (e: unknown) => boolean;
  signal?: AbortSignal;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new AbortError("aborted"));
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
    if (opts.signal?.aborted) throw new AbortError("aborted");
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (e instanceof AbortError) throw e;
      if (opts.signal?.aborted) throw new AbortError("aborted");
      if (!opts.shouldRetry(e)) throw e;
      if (attempt === opts.maxAttempts) throw e;
      await sleep(opts.baseDelayMs * 2 ** (attempt - 1), opts.signal);
    }
  }
  throw lastError;
}
