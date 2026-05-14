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

const AUTH_ERROR_MSG =
  "Anthropic API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요.";
const SERVER_ERROR_MSG =
  "AI 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.";
const MODAL_TITLE = "API 키를 입력해주세요";
const WELCOME_INTRO =
  "YouTube 영상 URL을 붙여넣으면 댓글을 자동으로 분석해드립니다.";

const ANTHROPIC_401_BODY = JSON.stringify({
  type: "error",
  error: {
    type: "authentication_error",
    message: "invalid x-api-key",
  },
});

const ANTHROPIC_500_BODY = JSON.stringify({
  type: "error",
  error: { type: "api_error", message: "internal server error" },
});

test.describe("error-recovery: 인증 + 재시도 복구", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockYouTubeMeta(page);
    await page.route(/youtube\/v3\/commentThreads[?/]/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ytComments),
      }),
    );
  });

  test("Anthropic 키 401 → AI_AUTH 에러 + 설정 모달 자동 오픈", async ({
    page,
  }) => {
    await page.route(/api\.anthropic\.com\/v1\/messages/, (route: Route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: ANTHROPIC_401_BODY,
      }),
    );

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // ClaudeAuthError → ErrorBanner 의 한국어 카피.
    // AriaLive 의 sr-only role="alert" 와 동시 매치되어 first() 사용.
    await expect(
      page
        .locator('[role="alert"]')
        .filter({ hasText: AUTH_ERROR_MSG })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    // determineActions 가 AI_AUTH 에서 ["openSettings"] 를 반환 →
    // ErrorBanner 에 "설정 열기" 버튼이 노출 (ErrorBanner 식별).
    await expect(
      page.getByRole("button", { name: "설정 열기" }),
    ).toBeVisible();

    // Effect 5 가 인증 에러에서 settingsOpen=true → 모달 자동 노출.
    await expect(
      page.getByRole("dialog", { name: MODAL_TITLE }),
    ).toBeVisible();
  });

  test("키 수정 후 저장 → URL/메타 컨텍스트가 보존된다 (idle 아님)", async ({
    page,
  }) => {
    await page.route(/api\.anthropic\.com\/v1\/messages/, (route: Route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: ANTHROPIC_401_BODY,
      }),
    );

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // 에러 + 자동 오픈 모달 도착까지 대기.
    await expect(
      page
        .locator('[role="alert"]')
        .filter({ hasText: AUTH_ERROR_MSG })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("dialog", { name: MODAL_TITLE }),
    ).toBeVisible();

    // 새 키 입력 → 저장. handleSaveKeys → setSettingsOpen(false) + dispatch(KEYS_SAVED).
    // reducer KEYS_SAVED 가 error+isAuthError 분기 → state.previous 로 복귀.
    await page.getByLabel("YouTube Data API 키").fill("AIza-fresh-yt-key");
    await page.getByLabel("Anthropic API 키").fill("sk-ant-fresh-key");
    await page.getByRole("button", { name: "저장", exact: true }).click();

    // 모달 닫힘 (state 가 error 가 아니므로 Effect 5 도 재오픈하지 않음).
    await expect(
      page.getByRole("dialog", { name: MODAL_TITLE }),
    ).toHaveCount(0);

    // URL 입력 필드에 직전 URL 이 그대로 남아있음 — deriveUrl 이 state.previous
    // 의 videoId 로부터 URL 을 재구성. idle 로 떨어지면 빈 값이 됨.
    await expect(page.getByLabel("YouTube 영상 URL")).toHaveValue(
      SAMPLE_VIDEO_URL,
    );

    // welcome.intro 가 보이면 idle 로 떨어진 것 — 회귀.
    await expect(page.getByText(WELCOME_INTRO)).toHaveCount(0);

    // ErrorBanner 가 사라짐 (state 가 error 가 아니므로 렌더되지 않음).
    await expect(
      page.getByRole("button", { name: "설정 열기" }),
    ).toHaveCount(0);
  });

  test("ClaudeServerError 후 '다시 시도' → 분석 재개 → 결과 도착 (Finding #4 회귀 락)", async ({
    page,
  }) => {
    // Anthropic 호출은 recoveryArmed flag 로 분기:
    //   - false (초기): 500 → withRetry+SDK 가 소진된 뒤 ClaudeServerError 로 변환
    //   - true (재시도 직전 flip): 200 + 정상 report → 결과 도착
    // 호출 횟수를 검증하지 않는다 (SDK 내부 retry + 우리의 withRetry 가 겹쳐 정확 카운트 환경 의존적).
    let recoveryArmed = false;
    await page.route(/api\.anthropic\.com\/v1\/messages/, (route: Route) => {
      if (recoveryArmed) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(claudeReport),
        });
      }
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: ANTHROPIC_500_BODY,
      });
    });

    await page.goto("/");
    await enterKeysAndStart(page, SAMPLE_VIDEO_URL);
    await expect(
      page.getByRole("heading", { name: "테스트 영상 제목" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // 첫 분석이 ClaudeServerError 로 마무리될 때까지 대기 (SDK + withRetry 누적 ~8-10s 가능).
    await expect(
      page
        .locator('[role="alert"]')
        .filter({ hasText: SERVER_ERROR_MSG })
        .first(),
    ).toBeVisible({ timeout: 60_000 });

    // 재시도 직전에 mock 을 복구 응답으로 flip.
    recoveryArmed = true;

    // "다시 시도" → RESET_ERROR. previous.kind 가 analyzing → 새 validating 상태로
    // 재진입 (Finding #4 fix). Effect 3 이 재발화하면서 orchestrator 가 다시 돌아간다.
    // 이 분기가 깨지면 (예: validating 재진입이 사라지면) 이 test 가 FAIL — 회귀 락.
    await page.getByRole("button", { name: "다시 시도" }).click();

    // 정상 결과 카드 도착.
    await expect(page.getByRole("heading", { name: "요약" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
