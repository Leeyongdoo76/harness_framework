import { expect, test } from "@playwright/test";
import {
  clearStorage,
  enterKeysAndStart,
  mockAll,
  SAMPLE_VIDEO_URL,
} from "./helpers";

const MODAL_TITLE = "API 키를 입력해주세요";
// 마지막 4자가 서로 달라야 maskKey 표현 ("••••••••" + last4) 이 unique 해진다.
const YT_KEY = "AIza-test-youtube-yt01";
const ANTH_KEY = "sk-ant-test-anthropic-an99";

// 분석 흐름이 정상적으로 사용해야 하는 외부 호스트만 화이트리스트.
// `index.html` 의 CSP `connect-src` + `img-src` 와 일치.
const ALLOWED_REMOTE_HOSTS = new Set<string>([
  "www.googleapis.com",
  "youtube.googleapis.com",
  "api.anthropic.com",
  "i.ytimg.com",
]);

test.describe("privacy: 키 / 트래픽 / 외부 송신", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("설정 모달의 키 필드는 type=password 로 가려지고 마지막 4자만 별도 노출된다", async ({
    page,
  }) => {
    await mockAll(page);
    await page.goto("/");

    // 키 입력 → idle 진입.
    await page.getByLabel("YouTube Data API 키").fill(YT_KEY);
    await page.getByLabel("Anthropic API 키").fill(ANTH_KEY);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("dialog", { name: MODAL_TITLE })).toHaveCount(0);

    // 헤더 "설정" 클릭 → edit 모달 재오픈.
    await page.getByRole("button", { name: "설정" }).click();
    const modal = page.getByRole("dialog", { name: MODAL_TITLE });
    await expect(modal).toBeVisible();

    // 두 입력 필드 모두 type="password" 로 시작 — 평문 노출 안 됨.
    const ytInput = modal.getByLabel("YouTube Data API 키");
    const anthInput = modal.getByLabel("Anthropic API 키");
    await expect(ytInput).toHaveAttribute("type", "password");
    await expect(anthInput).toHaveAttribute("type", "password");

    // value 속성에는 키가 보존돼있지만 type=password 로 화면에는 가려짐.
    await expect(ytInput).toHaveValue(YT_KEY);
    await expect(anthInput).toHaveValue(ANTH_KEY);

    // maskKey 표현 ("••••••••" + 마지막 4자) 이 시각적으로 노출.
    const ytMaskExpected = "••••••••" + YT_KEY.slice(-4);
    const anthMaskExpected = "••••••••" + ANTH_KEY.slice(-4);

    await expect(modal.getByText(ytMaskExpected, { exact: true })).toBeVisible();
    await expect(modal.getByText(anthMaskExpected, { exact: true })).toBeVisible();

    // "보기" 토글 클릭 시 type=text 로 바뀌어 원문 노출. (사용자 명시 액션 한정)
    await modal.getByRole("button", { name: "보기" }).first().click();
    await expect(ytInput).toHaveAttribute("type", "text");
  });

  test("분석 1회 흐름 동안 외부 네트워크 요청이 화이트리스트 호스트만 사용한다", async ({
    page,
  }) => {
    await mockAll(page);

    const seenHosts = new Set<string>();
    const violations: string[] = [];

    page.on("request", (req) => {
      const raw = req.url();
      // data: / blob: 는 호스트 없음 — 허용 (썸네일 fallback 등).
      if (raw.startsWith("data:") || raw.startsWith("blob:")) return;

      let host: string;
      try {
        host = new URL(raw).hostname;
      } catch {
        return;
      }

      // 로컬 dev 서버 (Vite, HMR, 정적 자원) 는 검증 대상 아님.
      if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
        return;
      }

      seenHosts.add(host);
      if (!ALLOWED_REMOTE_HOSTS.has(host)) {
        violations.push(`${req.method()} ${raw}`);
      }
    });

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    expect(
      violations,
      `whitelisted host 외부로 요청이 나갔다:\n${violations.join("\n")}`,
    ).toEqual([]);

    // 적어도 하나의 허용 호스트는 호출돼야 한다 (테스트가 의미를 가지려면).
    expect(seenHosts.size).toBeGreaterThan(0);
  });
});
