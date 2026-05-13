import { expect, test } from "@playwright/test";
import {
  clearStorage,
  enterKeysAndStart,
  mockAll,
  mockYouTubeMeta,
  SAMPLE_VIDEO_ID,
  SAMPLE_VIDEO_URL,
} from "./helpers";

test.describe("hash-restore: URL hash 새로고침 복원", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("분석 시작 직후 hash 갱신 → 새로고침 시 캐시된 결과 즉시 표시", async ({ page }) => {
    await mockAll(page);
    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);

    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // 분석 완료까지 대기
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // URL hash 갱신 확인
    await expect.poll(() => page.url()).toMatch(/#v=[A-Za-z0-9_-]{11}/);
    expect(page.url()).toContain(`#v=${SAMPLE_VIDEO_ID}`);

    // 새로고침 — Anthropic mock 제거 (캐시 hit 검증)
    await page.unroute(/api\.anthropic\.com\/v1\/messages/);
    await page.unroute(/youtube\/v3\/commentThreads[?/]/);
    // 메타만 다시 mock (1시간 캐시되어 있을 수 있지만 안전하게)
    await mockYouTubeMeta(page);
    await page.reload();

    // 캐시된 결과 노출 + "캐시된 결과" 카피 확인
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/캐시된 결과/)).toBeVisible();
  });
});
