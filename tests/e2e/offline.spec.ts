import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearStorage,
  enterKeysAndStart,
  enterKeysOnly,
  mockYouTubeMeta,
  SAMPLE_VIDEO_URL,
} from "./helpers";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, "..", "fixtures");
const ytComments = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, "youtube-comments.json"), "utf8"),
) as unknown;

const OFFLINE_MESSAGE = "오프라인입니다. 네트워크 연결을 확인해주세요.";
const ANALYZING_LABEL = "AI가 댓글을 분석하고 있어요…";

test.describe("offline: 네트워크 끊김 처리", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockYouTubeMeta(page);
    // 격리: 이전 test 의 offline 상태가 새 context 에 잔류하지 않게 보장.
    await page.context().setOffline(false);
  });

  test("오프라인 진입 시 상단 배너가 노출된다", async ({ page }) => {
    await page.goto("/");
    await enterKeysOnly(page);

    // idle 상태에서 offline 진입.
    await page.context().setOffline(false);
    // 사전 검증: 배너가 아직 없음.
    await expect(page.getByText(OFFLINE_MESSAGE)).toHaveCount(0);

    await page.context().setOffline(true);

    // OfflineBanner: role="status" + aria-live="polite" + 카피.
    // 동시에 ErrorBanner 는 아직 안 떴어야 함 (idle 에서는 error 가 dispatch 되지 않음).
    const banner = page
      .locator('[role="status"]')
      .filter({ hasText: OFFLINE_MESSAGE });
    await expect(banner).toBeVisible();
  });

  test("분석 중 오프라인 진입 → 진행 중단 + 에러 표시", async ({ page }) => {
    // 댓글 fetch 는 정상, Anthropic 호출은 무한 지연으로 analyzing 단계 유지.
    await page.route(/youtube\/v3\/commentThreads[?/]/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytComments),
      }),
    );
    await page.route(/api\.anthropic\.com\/v1\/messages/, async () => {
      await new Promise<void>(() => {
        /* never resolves — context close 가 정리 */
      });
    });

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // analyzing 단계 진입 확인.
    await expect(page.getByText(ANALYZING_LABEL)).toBeVisible({
      timeout: 10_000,
    });

    // Offline 으로 전환 — Effect 6 이 controller.abort() + OfflineError dispatch.
    await page.context().setOffline(true);

    // ProgressIndicator 사라짐.
    await expect(page.getByText(ANALYZING_LABEL)).toHaveCount(0, {
      timeout: 10_000,
    });

    // ErrorBanner 노출 (role="alert" + OfflineError.userMessage).
    // AriaLive 의 sr-only role="alert" 와 동시에 매치되므로 first() 사용.
    await expect(
      page
        .locator('[role="alert"]')
        .filter({ hasText: OFFLINE_MESSAGE })
        .first(),
    ).toBeVisible();

    // OfflineBanner 도 함께 떠있음.
    await expect(
      page.locator('[role="status"]').filter({ hasText: OFFLINE_MESSAGE }),
    ).toBeVisible();
  });

  test("온라인 복귀 시 배너가 사라진다", async ({ page }) => {
    await page.goto("/");
    await enterKeysOnly(page);

    // Offline → 배너 노출 검증.
    await page.context().setOffline(true);
    const banner = page
      .locator('[role="status"]')
      .filter({ hasText: OFFLINE_MESSAGE });
    await expect(banner).toBeVisible();

    // Online 복귀 → 배너 제거.
    await page.context().setOffline(false);
    await expect(banner).toHaveCount(0);
  });
});
