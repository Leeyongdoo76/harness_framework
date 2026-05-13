import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AbortError } from "@/types/errors";
import { withRetry } from "./retry";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const p = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, shouldRetry: () => true });
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries until success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("a"))
      .mockRejectedValueOnce(new Error("b"))
      .mockResolvedValue("ok");
    const p = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, shouldRetry: () => true });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws last error after maxAttempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    const p = withRetry(fn, { maxAttempts: 3, baseDelayMs: 5, shouldRetry: () => true });
    const settled = p.catch((e) => e);
    await vi.runAllTimersAsync();
    const e = await settled;
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toBe("nope");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent"));
    const p = withRetry(fn, { maxAttempts: 5, baseDelayMs: 10, shouldRetry: () => false });
    await expect(p).rejects.toThrow("permanent");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rethrows AbortError immediately without retry", async () => {
    const fn = vi.fn().mockRejectedValue(new AbortError("aborted"));
    const p = withRetry(fn, { maxAttempts: 5, baseDelayMs: 10, shouldRetry: () => true });
    await expect(p).rejects.toBeInstanceOf(AbortError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws AbortError when signal aborted before attempt", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        shouldRetry: () => true,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(AbortError);
    expect(fn).not.toHaveBeenCalled();
  });

  it("aborts mid-sleep when signal fires", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const p = withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1000,
      shouldRetry: () => true,
      signal: controller.signal,
    });
    const settled = p.catch((e) => e);
    // Trigger first attempt + enter sleep
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await vi.runAllTimersAsync();
    const e = await settled;
    expect(e).toBeInstanceOf(AbortError);
  });

  it("uses exponential backoff schedule", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const p = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, shouldRetry: () => true });
    const settled = p.catch((e) => e);
    await vi.runAllTimersAsync();
    await settled;
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1]);
    expect(delays).toContain(100);
    expect(delays).toContain(200);
  });
});
