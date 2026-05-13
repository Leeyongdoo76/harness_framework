import { expect, test } from "@playwright/test";
import {
  clearStorage,
  enterKeysAndStart,
  mockAll,
  SAMPLE_VIDEO_URL,
} from "./helpers";

test.describe("CSP/콘솔 청결성", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockAll(page);
  });

  test("smoke flow 동안 CSP 위반과 미처리 에러가 콘솔에 없다", async ({ page }) => {
    const errorMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errorMessages.push(msg.text());
    });
    page.on("pageerror", (err) => errorMessages.push(err.message));

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    const cspViolations = errorMessages.filter((m) =>
      /Content Security Policy/i.test(m),
    );
    expect(cspViolations).toEqual([]);

    // ErrorBoundary의 의도된 로그는 허용 — 그 외 미처리 에러 없어야 함
    const otherErrors = errorMessages.filter(
      (m) => !/^ErrorBoundary caught/i.test(m),
    );
    expect(otherErrors).toEqual([]);
  });
});
