import { expect, test } from "@playwright/test";
import {
  clearStorage,
  enterKeysAndStart,
  mockAll,
  SAMPLE_VIDEO_URL,
} from "./helpers";

test.describe("mobile viewport: 가로 스크롤 없음 + 카드 1열", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockAll(page);
  });

  test("모바일 viewport에서 결과 표시 + 가로 스크롤 없음 + 카드 1열", async ({ page }) => {
    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);

    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // 가로 스크롤 없음
    const hasOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    // 6개 카드 (h3 > section) 모두 부모 너비에 가까운 1열 배치
    const cardSections = page.locator("section.fade-in");
    const count = await cardSections.count();
    expect(count).toBeGreaterThanOrEqual(6);

    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(viewportWidth).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await cardSections.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box === null) continue;
      // 카드는 부모 너비를 대부분 채워야 함 (1열 → 60% 이상)
      expect(box.width / viewportWidth).toBeGreaterThan(0.6);
    }
  });
});
