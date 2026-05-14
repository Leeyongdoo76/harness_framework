import type { Page, Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, "..", "fixtures");

function loadFixture(name: string): unknown {
  const raw = readFileSync(resolve(FIXTURES_DIR, name), "utf8");
  return JSON.parse(raw);
}

const ytMeta = loadFixture("youtube-meta.json");
const ytComments = loadFixture("youtube-comments.json");
const claudeReport = loadFixture("claude-report.json");

const fulfillJson = (route: Route, body: unknown): Promise<void> =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

export async function mockYouTubeMeta(page: Page): Promise<void> {
  // Production code calls https://www.googleapis.com/youtube/v3/videos
  // (alias of youtube.googleapis.com/youtube/v3/videos per YouTube docs).
  await page.route(/youtube\/v3\/videos[?/]/, (route) => fulfillJson(route, ytMeta));
}

export async function mockYouTubeComments(page: Page): Promise<void> {
  await page.route(/youtube\/v3\/commentThreads[?/]/, (route) =>
    fulfillJson(route, ytComments),
  );
}

export async function mockAnthropic(page: Page): Promise<void> {
  await page.route(/api\.anthropic\.com\/v1\/messages/, (route) =>
    fulfillJson(route, claudeReport),
  );
}

export async function mockAll(page: Page): Promise<void> {
  await mockYouTubeMeta(page);
  await mockYouTubeComments(page);
  await mockAnthropic(page);
}

export async function clearStorage(page: Page): Promise<void> {
  // window.name persists across reloads of the same tab, so we use it as a
  // first-load sentinel — otherwise this init script would also fire on
  // page.reload() and wipe caches that hash-restore.spec relies on.
  await page.addInitScript(() => {
    if (window.name !== "__cleared__") {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        /* ignore Safari private mode */
      }
      window.name = "__cleared__";
    }
  });
}

export async function enterKeysAndStart(page: Page, videoUrl: string): Promise<void> {
  const ytInput = page.getByLabel("YouTube Data API 키");
  const anthInput = page.getByLabel("Anthropic API 키");
  await ytInput.fill("AIza-test-youtube-key");
  await anthInput.fill("sk-ant-test-anthropic-key");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  const urlInput = page.getByLabel("YouTube 영상 URL");
  await urlInput.fill(videoUrl);
  await urlInput.blur();
}

export const SAMPLE_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
export const SAMPLE_VIDEO_ID = "dQw4w9WgXcQ";
