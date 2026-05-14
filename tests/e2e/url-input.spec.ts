import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearStorage,
  enterKeysOnly,
  mockAll,
  mockYouTubeMeta,
  SAMPLE_VIDEO_ID,
  SAMPLE_VIDEO_URL,
} from "./helpers";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, "..", "fixtures");
const ytMetaFixture = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, "youtube-meta.json"), "utf8"),
) as unknown;

test.describe("url-input: URL 검증", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockAll(page);
    await page.goto("/");
    await enterKeysOnly(page);
  });

  test("잘못된 URL 4종이 각자 다른 인라인 에러를 표시한다", async ({ page }) => {
    const urlInput = page.getByLabel("YouTube 영상 URL");

    type Case = { url: string; error: string };
    const cases: Case[] = [
      { url: "https://vimeo.com/12345", error: "YouTube URL이 아닙니다" },
      {
        url: "https://www.youtube.com/watch?v=short",
        error: "올바른 영상 URL이 아닙니다",
      },
      {
        url: "https://www.youtube.com/playlist?list=PL123",
        error: "영상 URL만 지원합니다 (플레이리스트 불가)",
      },
      {
        url: "https://www.youtube.com/@channelname",
        error: "영상 URL만 지원합니다",
      },
    ];

    for (const { url, error } of cases) {
      await urlInput.fill("");
      await urlInput.fill(url);
      await urlInput.blur();
      await expect(page.getByRole("alert").filter({ hasText: error })).toBeVisible();
    }
  });

  test("blur 또는 Enter 시 메타 호출이 발생한다", async ({ page }) => {
    // blur 케이스 — 자체 counter 로 호출 횟수 측정.
    let blurCalls = 0;
    await page.unroute(/youtube\/v3\/videos[?/]/);
    await page.route(/youtube\/v3\/videos[?/]/, (route: Route) => {
      blurCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytMetaFixture),
      });
    });

    const urlInput = page.getByLabel("YouTube 영상 URL");
    await urlInput.fill(SAMPLE_VIDEO_URL);
    await urlInput.blur();
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    expect(blurCalls).toBe(1);

    // Enter 케이스 — 새 페이지로 격리해서 counter 리셋.
    await page.evaluate(() => window.localStorage.clear());
    await page.goto("/");
    await enterKeysOnly(page);

    let enterCalls = 0;
    await page.unroute(/youtube\/v3\/videos[?/]/);
    await page.route(/youtube\/v3\/videos[?/]/, (route: Route) => {
      enterCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytMetaFixture),
      });
    });

    const urlInput2 = page.getByLabel("YouTube 영상 URL");
    await urlInput2.fill(SAMPLE_VIDEO_URL);
    await urlInput2.press("Enter");
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    expect(enterCalls).toBe(1);
  });

  test("같은 videoId 를 재입력해도 메타 재호출이 발생하지 않는다", async ({
    page,
  }) => {
    let calls = 0;
    await page.unroute(/youtube\/v3\/videos[?/]/);
    await page.route(/youtube\/v3\/videos[?/]/, (route: Route) => {
      calls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytMetaFixture),
      });
    });

    const urlInput = page.getByLabel("YouTube 영상 URL");
    await urlInput.fill(SAMPLE_VIDEO_URL);
    await urlInput.blur();
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    expect(calls).toBe(1);

    // 같은 URL 재입력 + blur — 메타 재호출 없음 (de-dupe 또는 1시간 캐시).
    await urlInput.fill("");
    await urlInput.fill(SAMPLE_VIDEO_URL);
    await urlInput.blur();
    // metaReady 상태가 유지되므로 영상 제목이 여전히 보임.
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    expect(calls).toBe(1);
  });

  test("메타 호출 후 localStorage 에 videometa:{videoId} 키가 존재한다", async ({
    page,
  }) => {
    // 메타 mock 은 beforeEach 의 mockAll 로 이미 등록됨. 추가 명시 호출 불필요.
    await mockYouTubeMeta(page);

    const urlInput = page.getByLabel("YouTube 영상 URL");
    await urlInput.fill(SAMPLE_VIDEO_URL);
    await urlInput.blur();
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();

    const entry = await page.evaluate(
      (id: string) => window.localStorage.getItem(`videometa:${id}`),
      SAMPLE_VIDEO_ID,
    );
    expect(entry).not.toBeNull();
    if (entry === null) return;
    const parsed = JSON.parse(entry) as { videoMeta?: unknown };
    expect(parsed.videoMeta).toBeDefined();
  });
});
