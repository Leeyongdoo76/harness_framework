import { expect, test } from "@playwright/test";
import {
  clearStorage,
  enterKeysAndStart,
  enterKeysOnly,
  mockAll,
  SAMPLE_VIDEO_URL,
} from "./helpers";

const WELCOME_INTRO =
  "YouTube 영상 URL을 붙여넣으면 댓글을 자동으로 분석해드립니다.";
const MODAL_TITLE = "API 키를 입력해주세요";
const GUIDE_CLOSED = "API 키는 어떻게 받나요?";
const GUIDE_OPEN = "가이드 닫기";
const YOUTUBE_GUIDE_SNIPPET = "Google Cloud Console에 접속";
const DELETE_ALL = "모든 데이터 삭제";
const DELETE_CONFIRM_TITLE = "모든 데이터를 삭제할까요?";
const DELETE_CONFIRM_ACTION = "삭제";

test.describe("first-entry: 첫 진입 화면", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockAll(page);
  });

  test("환영 카피가 1줄로 표시된다", async ({ page }) => {
    await page.goto("/");
    // welcome.intro 는 idle 상태에서 노출 — needs_keys 모달 닫은 직후 확인.
    await enterKeysOnly(page);
    await expect(page.getByText(WELCOME_INTRO)).toBeVisible();
  });

  test("needs_keys 모달은 ESC / 배경 클릭으로 닫히지 않는다", async ({ page }) => {
    await page.goto("/");

    const modal = page.getByRole("dialog", { name: MODAL_TITLE });
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible();

    // 배경(모달 바깥) 클릭 — 모달 외곽 영역 좌상단.
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await expect(modal).toBeVisible();

    // 키 미입력 상태가 유지되는지 — 저장 버튼이 여전히 disabled.
    await expect(
      page.getByRole("button", { name: "저장", exact: true }),
    ).toBeDisabled();
  });

  test("가이드 토글이 펼침/접힘 한다", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: GUIDE_CLOSED });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(YOUTUBE_GUIDE_SNIPPET)).toHaveCount(0);

    await toggle.click();
    const openToggle = page.getByRole("button", { name: GUIDE_OPEN });
    await expect(openToggle).toBeVisible();
    await expect(openToggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(YOUTUBE_GUIDE_SNIPPET)).toBeVisible();

    await openToggle.click();
    await expect(page.getByRole("button", { name: GUIDE_CLOSED })).toBeVisible();
    await expect(page.getByText(YOUTUBE_GUIDE_SNIPPET)).toHaveCount(0);
  });

  test("두 키 모두 입력해야 저장 버튼이 활성화된다", async ({ page }) => {
    await page.goto("/");

    const saveBtn = page.getByRole("button", { name: "저장", exact: true });
    await expect(saveBtn).toBeDisabled();

    await page.getByLabel("YouTube Data API 키").fill("AIza-only");
    await expect(saveBtn).toBeDisabled();

    await page.getByLabel("Anthropic API 키").fill("sk-ant-only");
    await expect(saveBtn).toBeEnabled();
  });

  test("모든 데이터 삭제 → 4종 prefix 가 localStorage 에서 사라진다", async ({
    page,
  }) => {
    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);

    // VideoMetaPreview 도착 후 분석 1회 완료.
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });

    // 사전 검증: keys / report / videometa prefix 가 모두 최소 1개 존재.
    const beforeKeys = await page.evaluate<string[]>(() =>
      Object.keys(window.localStorage),
    );
    expect(beforeKeys.some((k) => k.startsWith("keys:"))).toBe(true);
    expect(beforeKeys.some((k) => k.startsWith("report:"))).toBe(true);
    expect(beforeKeys.some((k) => k.startsWith("videometa:"))).toBe(true);

    // 설정 모달 열기 → "모든 데이터 삭제" → 확인 다이얼로그 → 삭제.
    await page.getByRole("button", { name: "설정" }).click();
    await expect(
      page.getByRole("dialog", { name: MODAL_TITLE }),
    ).toBeVisible();
    await page.getByRole("button", { name: DELETE_ALL }).click();

    const confirmDialog = page.getByRole("dialog", {
      name: DELETE_CONFIRM_TITLE,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: DELETE_CONFIRM_ACTION })
      .click();

    // 사후 검증: 4종 prefix 가 전부 사라짐.
    const afterPrefixed = await page.evaluate<string[]>(() =>
      Object.keys(window.localStorage).filter((k) =>
        /^(keys:|report:|videometa:|flag:)/.test(k),
      ),
    );
    expect(afterPrefixed).toEqual([]);

    // needs_keys 상태로 전환 — 모달 재노출.
    await expect(page.getByRole("dialog", { name: MODAL_TITLE })).toBeVisible();
  });
});
