import { expect, test } from "@playwright/test";
import {
  clearStorage,
  enterKeysAndStart,
  mockAll,
  SAMPLE_VIDEO_URL,
} from "./helpers";

test.describe("smoke: 기본 분석 흐름", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockAll(page);
  });

  test("키 입력 → URL 입력 → 분석 → 결과 6개 카드 렌더", async ({ page }) => {
    await page.goto("/");

    // 1. API 키 모달 노출
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { name: "API 키를 입력해주세요" })).toBeVisible();

    // 2. 키 저장 + URL 입력 + blur 시 메타 호출 트리거
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);

    // 3. VideoMetaPreview 노출 (영상 제목 검증)
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await expect(page.getByText("테스트 채널")).toBeVisible();

    // 4. "분석 시작" 클릭 → 진행 → 결과
    await page.getByRole("button", { name: "분석 시작" }).click();

    // 5. 결과 카드 6종 모두 노출
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "감정 분포" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "잘하고 있는 점" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "개선할 점" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "자주 등장한 키워드" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "주목할 만한 댓글" })).toBeVisible();

    // 6. 면책 카피 노출
    await expect(
      page.getByText(
        "AI가 자동으로 분석한 결과입니다. 100% 정확하지 않을 수 있으며 참고용으로 활용해주세요.",
      ),
    ).toBeVisible();

    // 7. 결과 헤더에 표본 크기 노출
    await expect(page.getByText(/방금 분석 · 댓글 50개 기준/)).toBeVisible();
  });
});
