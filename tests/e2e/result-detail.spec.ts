import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearStorage,
  enterKeysAndStart,
  mockAll,
  mockYouTubeMeta,
  SAMPLE_VIDEO_URL,
} from "./helpers";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, "..", "fixtures");
const ytCommentsFew = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, "youtube-comments-few.json"), "utf8"),
) as unknown;
const claudeReportFew = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, "claude-report-few.json"), "utf8"),
) as unknown;

const DISCLAIMER =
  "AI가 자동으로 분석한 결과입니다. 100% 정확하지 않을 수 있으며 참고용으로 활용해주세요.";

test.describe("result: 결과 디테일", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("결과 헤더에 분석 시점 + 표본 크기가 표시된다", async ({ page }) => {
    await mockAll(page);

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // 시간 라벨 + 댓글 수 라벨 둘 다 존재.
    await expect(page.getByText(/방금 분석.*댓글 \d+개 기준/)).toBeVisible();
    await expect(page.getByText(/댓글 50개 기준/)).toBeVisible();
  });

  test("면책 카피가 결과 화면에 노출된다", async ({ page }) => {
    await mockAll(page);

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
  });

  test("댓글 수 < 10 이면 lowConfidence 경고가 노출된다", async ({ page }) => {
    // fixture-few 로 교체 — 5개 댓글.
    await mockYouTubeMeta(page);
    await page.route(/youtube\/v3\/commentThreads[?/]/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytCommentsFew),
      }),
    );
    await page.route(/api\.anthropic\.com\/v1\/messages/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(claudeReportFew),
      }),
    );

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // result.lowConfidence: "댓글 표본이 적어(5개) 분석 신뢰도가 낮을 수 있습니다"
    await expect(
      page.getByText("댓글 표본이 적어(5개) 분석 신뢰도가 낮을 수 있습니다"),
    ).toBeVisible();
    // 5개 기준 표시도 함께 확인.
    await expect(page.getByText(/댓글 5개 기준/)).toBeVisible();
  });

  test("캐시 히트 시 헤더가 '캐시된 결과' 형태로 노출되고 재분석 버튼이 존재한다", async ({
    page,
  }) => {
    await mockAll(page);
    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // fresh fetch 차단 — 캐시 hit 이 진짜 캐시에서 오는지 보장하기 위해
    // commentThreads / anthropic mock 을 제거하고 호출 카운터로 검증.
    await page.unroute(/youtube\/v3\/commentThreads[?/]/);
    await page.unroute(/api\.anthropic\.com\/v1\/messages/);

    let commentThreadCalls = 0;
    let anthropicCalls = 0;
    page.on("request", (req) => {
      const url = req.url();
      if (/youtube\/v3\/commentThreads/.test(url)) commentThreadCalls += 1;
      if (/api\.anthropic\.com\/v1\/messages/.test(url)) anthropicCalls += 1;
    });

    await page.reload();

    // 캐시된 결과 즉시 노출.
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // result.headerCached 패턴: "{relativeTime} 분석 · 캐시된 결과 · 댓글 {count}개 기준"
    await expect(page.getByText(/캐시된 결과.*댓글 \d+개 기준/)).toBeVisible();

    // 재분석 버튼 존재.
    await expect(
      page.getByRole("button", { name: "재분석" }),
    ).toBeVisible();

    // fresh fetch 가 발생하지 않았는지 확인 — 캐시 hit 진위 검증.
    expect(commentThreadCalls).toBe(0);
    expect(anthropicCalls).toBe(0);
  });
});
