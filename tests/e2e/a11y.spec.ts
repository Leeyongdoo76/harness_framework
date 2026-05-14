import { expect, test } from "@playwright/test";
import {
  clearStorage,
  enterKeysAndStart,
  enterKeysOnly,
  mockAll,
  SAMPLE_VIDEO_URL,
} from "./helpers";

const MODAL_TITLE = "API 키를 입력해주세요";

test.describe("a11y: 접근성", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockAll(page);
  });

  test("모달 focus trap — Tab / Shift+Tab 이 모달 안에서 wrap 된다", async ({ page }) => {
    await page.goto("/");
    const modal = page.getByRole("dialog", { name: MODAL_TITLE });
    await expect(modal).toBeVisible();

    // focus 가 모달 내부 (role=dialog) 에 있는지 검사하는 헬퍼.
    const isFocusInsideDialog = async (): Promise<boolean> =>
      page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      );

    // 모달 안의 focusable 원소 수를 동적으로 측정 (입력 개수 변화에 brittle 하지 않도록).
    const FOCUSABLE_SELECTOR =
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableCount = await modal.locator(FOCUSABLE_SELECTOR).count();
    expect(focusableCount).toBeGreaterThan(0);

    // 초기 mount 시 첫 focusable 로 focus 가 잡힘. focusableCount + 2 회 Tab 을 눌러
    // 트랩이 적어도 한 번은 wrap 을 수행하게 만들고, 매 번 dialog 내부인지 검증.
    for (let i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press("Tab");
      expect(await isFocusInsideDialog()).toBe(true);
    }

    // 반대 방향도 동일하게 검증.
    for (let i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await isFocusInsideDialog()).toBe(true);
    }
  });

  test("needs_keys 모달은 ESC 로 닫히지 않는다", async ({ page }) => {
    await page.goto("/");
    const modal = page.getByRole("dialog", { name: MODAL_TITLE });
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible();
  });

  test("edit (설정) 모달은 ESC 로 닫힌다", async ({ page }) => {
    await page.goto("/");
    await enterKeysOnly(page);

    // idle 상태에서 헤더 "설정" 클릭 → edit 모드로 모달 재오픈.
    await page.getByRole("button", { name: "설정" }).click();
    const modal = page.getByRole("dialog", { name: MODAL_TITLE });
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    // idle 화면 복귀 검증 — URL 입력 영역이 다시 보임.
    await expect(page.getByLabel("YouTube 영상 URL")).toBeVisible();
  });

  test("prefers-reduced-motion: reduce 환경에선 fade-in animation 이 비활성화된다", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // 결과 카드들에 적용된 .fade-in 의 computed animationDuration 을 읽어
    // 전역 reduced-motion 미디어 쿼리의 !important 규칙이 적용됐는지 확인한다.
    // index.css 의 reduce 분기: `animation-duration: 0.001ms !important`.
    // Chromium 은 매우 작은 값을 초 단위 과학표기법 ("1e-06s") 으로 직렬화하기도 하므로
    // 문자열 비교 대신 초 단위 수치로 환산해 1ms 미만인지 확인한다.
    const card = page.locator("section.fade-in").first();
    const animDurationSec = await card.evaluate((el) => {
      const raw = window.getComputedStyle(el).animationDuration;
      if (raw.endsWith("ms")) return parseFloat(raw) / 1000;
      if (raw.endsWith("s")) return parseFloat(raw);
      return Number.NaN;
    });
    expect(animDurationSec).toBeGreaterThanOrEqual(0);
    expect(animDurationSec).toBeLessThan(0.001);
  });

  test("reduce 미설정 환경에선 fade-in animation 이 정상 활성화된다 (대비 검증)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    const card = page.locator("section.fade-in").first();
    const animDurationSec = await card.evaluate((el) => {
      const raw = window.getComputedStyle(el).animationDuration;
      if (raw.endsWith("ms")) return parseFloat(raw) / 1000;
      if (raw.endsWith("s")) return parseFloat(raw);
      return Number.NaN;
    });
    // .fade-in { animation: fadeIn 0.4s ease-out both; } → 0.4s
    expect(animDurationSec).toBeCloseTo(0.4, 3);
  });

  test("sentiment 차트가 색뿐 아니라 라벨 + 퍼센트 텍스트도 노출한다", async ({
    page,
  }) => {
    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // claude-report.json fixture: positive=78, neutral=15, negative=7.
    // 차트 카드 안에서 "긍정 78%", "중립 15%", "부정 7%" 텍스트가 노출돼야 한다.
    const chartCard = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "감정 분포" }) });
    await expect(chartCard).toBeVisible();

    // "긍정 78%" 형태 텍스트 (legend 또는 sr-only 텍스트 대안 — 둘 다 색 외 정보 전달).
    await expect(chartCard.getByText(/긍정\s*78\s*%/).first()).toBeVisible();
    await expect(chartCard.getByText(/중립\s*15\s*%/).first()).toBeVisible();
    await expect(chartCard.getByText(/부정\s*7\s*%/).first()).toBeVisible();
  });

  test("키워드 태그가 sentiment 라벨 (긍정/중립/부정) 을 색과 별도로 노출한다", async ({
    page,
  }) => {
    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // KeywordsCard 의 각 태그는 role="img" 와 aria-label 에 sentiment 라벨
    // ("긍정 키워드 X, N건" / "중립 …" / "부정 …") 을 노출한다. 색 단독이 아닌
    // 접근성 트리에 라벨이 실리는지 검증 (색맹 사용자 의미 전달).
    const keywordsCard = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "자주 등장한 키워드" }) });
    await expect(keywordsCard).toBeVisible();

    const tags = keywordsCard.locator('[role="img"]');
    const count = await tags.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const label = await tags.nth(i).getAttribute("aria-label");
      expect(label, `tag #${i} aria-label`).toMatch(/(긍정|중립|부정)/);
    }
  });
});
