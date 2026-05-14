import { describe, expect, it } from "vitest";
import { t } from "./copy";
import type { CopyKey } from "@/types/copy";

describe("t", () => {
  it("returns plain string for parameter-less key", () => {
    expect(t("header.title")).toBe("YouTube 댓글 분석");
  });

  it("substitutes a single named parameter", () => {
    expect(t("meta.commentCountFormat", { count: 87 })).toBe("87개");
  });

  it("substitutes multiple named parameters", () => {
    expect(t("result.headerCached", { relativeTime: "3일 전", count: 42 })).toBe(
      "3일 전 분석 · 캐시된 결과 · 댓글 42개 기준",
    );
  });

  it("leaves placeholder intact when param missing", () => {
    expect(t("meta.commentCountFormat")).toBe("{count}개");
  });

  it("coerces numeric param via String()", () => {
    expect(t("relTime.minutesAgo", { n: 5 })).toBe("5분 전");
  });

  it("returns the same string for known error/code keys", () => {
    expect(t("error.retry")).toBe("다시 시도");
    expect(t("boundary.refresh")).toBe("새로고침");
    expect(t("relTime.over30Days")).toBe("30일 이상 전");
  });
});

describe("copy SSOT", () => {
  // PRD.md 의 "마이크로 카피 표 (SSOT)" 섹션을 통째로 훑어서 작성.
  // 새로 추가된 카피 키가 있으면 이 배열에도 같이 추가해야 한다.
  // 도메인 에러 code → userMessage 표 (INVALID_URL 등) 는 errors.ts 에서 관리되므로 제외.
  const REQUIRED_KEYS: readonly CopyKey[] = [
    // 환영
    "welcome.intro",

    // 헤더
    "header.title",
    "header.settings",
    "header.reanalyze",

    // 상태 안내 (aria-live)
    "status.analysisComplete",
    "status.fetchingStarted",
    "status.analyzingStarted",
    "status.cancelled",

    // API 키 모달
    "keys.modalTitle",
    "keys.modalIntro",
    "keys.youtubeLabel",
    "keys.youtubePlaceholder",
    "keys.anthropicLabel",
    "keys.anthropicPlaceholder",
    "keys.showToggle",
    "keys.hideToggle",
    "keys.save",
    "keys.guideToggleClosed",
    "keys.guideToggleOpen",
    "keys.youtubeGuide",
    "keys.anthropicGuide",
    "keys.youtubeGuideLink",
    "keys.anthropicGuideLink",
    "keys.deleteAll",
    "keys.deleteConfirmTitle",
    "keys.deleteConfirmBody",
    "keys.deleteConfirmAction",
    "keys.deleteCancel",

    // URL 입력
    "url.label",
    "url.placeholder",
    "url.submit",
    "url.errorInvalidDomain",
    "url.errorInvalidVideo",
    "url.errorPlaylist",
    "url.errorChannel",

    // 영상 메타 미리보기
    "meta.previewTitle",
    "meta.channelLabel",
    "meta.commentCountLabel",
    "meta.commentCountFormat",
    "meta.metaLoadError",
    "meta.metaAuthError",

    // 진행 표시
    "progress.fetching",
    "progress.analyzing",
    "progress.estimate",
    "progress.cancel",

    // 결과 헤더
    "result.headerJustNow",
    "result.headerCached",
    "result.openVideo",
    "result.disclaimer",
    "result.lowConfidence",
    "result.truncatedNotice",
    "result.languageLabel",

    // 카드 제목
    "card.summary",
    "card.sentiment",
    "card.strengths",
    "card.improvements",
    "card.keywords",
    "card.notableComments",

    // 차트 라벨
    "sentiment.positive",
    "sentiment.neutral",
    "sentiment.negative",

    // 카드 빈 상태 / 인터랙션
    "card.emptyStrengths",
    "card.emptyImprovements",
    "card.emptyKeywords",
    "card.emptyNotable",
    "card.evidenceLabel",
    "card.evidenceMore",
    "card.evidenceLess",
    "card.likesFormat",

    // 빈 상태 (분석 결과 없음)
    "empty.commentsDisabledTitle",
    "empty.commentsDisabledBody",
    "empty.noCommentsTitle",
    "empty.noCommentsBody",

    // 에러 배너 액션
    "error.retry",
    "error.editUrl",
    "error.openSettings",
    "error.refreshPage",

    // Toast
    "toast.storageFallback",
    "toast.cacheSaveFailed",
    "toast.copied",

    // 푸터
    "footer.disclaimer",
    "footer.privacy",
    "footer.source",

    // React ErrorBoundary
    "boundary.title",
    "boundary.body",
    "boundary.refresh",
    "boundary.reportSecondary",

    // 페이지 메타
    "meta.titleDefault",
    "meta.titleAnalyzing",
    "meta.titleResult",
    "meta.description",

    // 상대 시간
    "relTime.justNow",
    "relTime.minutesAgo",
    "relTime.hoursAgo",
    "relTime.daysAgo",
    "relTime.weeksAgo",
    "relTime.over30Days",
  ];

  it("PRD 카피 표의 모든 key 가 정의되고 비어있지 않다", () => {
    for (const key of REQUIRED_KEYS) {
      const value = t(key);
      expect(value, `copy key missing: ${key}`).toBeTruthy();
      expect(value.length, `copy key empty: ${key}`).toBeGreaterThan(0);
    }
  });

  it("REQUIRED_KEYS 가 중복 없이 unique 하다", () => {
    const seen = new Set<CopyKey>();
    for (const key of REQUIRED_KEYS) {
      expect(seen.has(key), `duplicate key in REQUIRED_KEYS: ${key}`).toBe(false);
      seen.add(key);
    }
  });
});
