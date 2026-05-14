import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearStorage,
  enterKeysAndStart,
  mockAll,
  mockYouTubeMeta,
  SAMPLE_VIDEO_ID,
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

const TITLE_ANALYZING = "분석 중… - YouTube 댓글 분석";
const VIDEO_TITLE = "테스트 영상 제목";

test.describe("page-meta: title + hash", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("분석 중에 document.title 이 '분석 중… - YouTube 댓글 분석' 로 변한다", async ({
    page,
  }) => {
    // commentThreads 는 정상 응답, Anthropic 만 지연 시켜 analyzing 상태에서 title 을 읽을 시간 확보.
    await mockYouTubeMeta(page);
    await page.route(/youtube\/v3\/commentThreads[?/]/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytComments),
      }),
    );
    await page.route(/api\.anthropic\.com\/v1\/messages/, async (route: Route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(claudeReport),
      });
    });

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: VIDEO_TITLE }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // analyzing 진입까지 wait — 카피 키 "progress.analyzing" 가 화면에 노출되면 진입.
    await expect(page.getByText("AI가 댓글을 분석하고 있어요…")).toBeVisible({
      timeout: 10_000,
    });

    // 이 시점에 document.title 은 meta.titleAnalyzing 과 일치해야 한다.
    await expect.poll(() => page.title(), { timeout: 5_000 }).toBe(TITLE_ANALYZING);
  });

  test("결과 도착 시 document.title 이 '{영상 제목} - 분석 결과' 로 변한다", async ({
    page,
  }) => {
    await mockAll(page);

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: VIDEO_TITLE }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // meta.titleResult 카피 형태: "{videoTitle} - 분석 결과".
    await expect.poll(() => page.title(), { timeout: 5_000 }).toBe(
      `${VIDEO_TITLE} - 분석 결과`,
    );
  });

  test("URL hash 가 '분석 시작' 클릭 직후 즉시 갱신된다 (결과 도착 전)", async ({
    page,
  }) => {
    // commentThreads + Anthropic 둘 다 무한 지연 → 분석이 절대 끝나지 않음.
    // 그 와중에도 hash 는 클릭 즉시 갱신돼야 한다 (ADR-026).
    await mockYouTubeMeta(page);
    await page.route(/youtube\/v3\/commentThreads[?/]/, async () => {
      await new Promise<void>(() => {
        /* never resolves — test teardown 이 정리 */
      });
    });
    await page.route(/api\.anthropic\.com\/v1\/messages/, async () => {
      await new Promise<void>(() => {
        /* never resolves */
      });
    });

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: VIDEO_TITLE }),
    ).toBeVisible();

    // 클릭 전: hash 비어있음 (또는 분석 시작 전 상태).
    expect(page.url()).not.toContain(`#v=${SAMPLE_VIDEO_ID}`);

    await page.getByRole("button", { name: "분석 시작" }).click();

    // 분석 시작 직후 — 결과 도착 전인데도 hash 가 즉시 #v=<videoId> 로 갱신.
    await expect.poll(() => page.url(), { timeout: 3_000 }).toMatch(
      new RegExp(`#v=${SAMPLE_VIDEO_ID}$`),
    );

    // sanity check: 결과 카드는 아직 도착 안 함 (분석 진행 중 화면).
    await expect(page.getByRole("heading", { name: "요약" })).toHaveCount(0);
  });
});
