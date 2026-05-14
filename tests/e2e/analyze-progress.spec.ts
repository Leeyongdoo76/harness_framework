import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearStorage,
  enterKeysAndStart,
  mockYouTubeMeta,
  SAMPLE_VIDEO_URL,
} from "./helpers";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, "..", "fixtures");
const ytComments = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, "youtube-comments.json"), "utf8"),
) as unknown;
const claudeReport = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, "claude-report.json"), "utf8"),
) as unknown;

const FETCHING_LABEL = "댓글을 모으고 있어요…";
const ANALYZING_LABEL = "AI가 댓글을 분석하고 있어요…";

test.describe("analyze: 진행 + 취소", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockYouTubeMeta(page);
  });

  test("진행 표시가 두 단계로 전환된다 (댓글 수집 → AI 분석)", async ({ page }) => {
    // 두 단계 각각 1초 지연 → fetching/analyzing 라벨이 각각 충분히 관찰 가능.
    await page.route(/youtube\/v3\/commentThreads[?/]/, async (route: Route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytComments),
      });
    });
    await page.route(/api\.anthropic\.com\/v1\/messages/, async (route: Route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(claudeReport),
      });
    });

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // 1단계: 댓글 수집 진행 표시
    await expect(page.getByText(FETCHING_LABEL)).toBeVisible();

    // 2단계: AI 분석으로 전환
    await expect(page.getByText(ANALYZING_LABEL)).toBeVisible({
      timeout: 10_000,
    });

    // 최종 결과 도착
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("취소 버튼을 누르면 분석이 중단되고 idle 로 복귀한다", async ({ page }) => {
    // commentThreads 는 정상 응답해서 analyzing 단계까지 도달시킨다.
    await page.route(/youtube\/v3\/commentThreads[?/]/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytComments),
      }),
    );

    // Anthropic 응답을 무한 지연. fulfill 을 호출하지 않고 abort 대기.
    // 라우트 핸들러는 abort 시 자동 정리되므로 timeout 누수 없음.
    await page.route(/api\.anthropic\.com\/v1\/messages/, async (route: Route) => {
      // signal 이 abort 되면 route 핸들러가 종료되도록 무한 대기.
      await new Promise<void>(() => {
        /* never resolves — page.close() 가 정리 */
      });
      // unreachable
      await route.fulfill({ status: 200, body: "{}" });
    });

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // analyzing 단계까지 진입했는지 확인.
    await expect(page.getByText(ANALYZING_LABEL)).toBeVisible({
      timeout: 10_000,
    });

    // 취소 버튼 클릭.
    await page.getByRole("button", { name: "취소", exact: true }).click();

    // idle 복귀: ProgressIndicator 사라지고 URL 입력 화면 노출.
    await expect(page.getByText(ANALYZING_LABEL)).toHaveCount(0);
    await expect(page.getByLabel("YouTube 영상 URL")).toBeVisible();
    // 결과 카드가 없는지 확인.
    await expect(page.getByRole("heading", { name: "요약" })).toHaveCount(0);
  });
});
