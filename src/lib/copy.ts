import type { CopyKey } from "@/types/copy";

const copy: Record<CopyKey, string> = {
  "welcome.intro": "YouTube 영상 URL을 붙여넣으면 댓글을 자동으로 분석해드립니다.",

  "header.title": "YouTube 댓글 분석",
  "header.settings": "설정",
  "header.reanalyze": "재분석",

  "status.analysisComplete": "분석이 완료되었습니다",
  "status.fetchingStarted": "댓글 수집을 시작합니다",
  "status.analyzingStarted": "AI 분석을 시작합니다",
  "status.cancelled": "분석이 취소되었습니다",

  "keys.modalTitle": "API 키를 입력해주세요",
  "keys.modalIntro":
    "분석에 필요한 두 개의 API 키를 입력해주세요. 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.",
  "keys.youtubeLabel": "YouTube Data API 키",
  "keys.youtubePlaceholder": "AIza...",
  "keys.anthropicLabel": "Anthropic API 키",
  "keys.anthropicPlaceholder": "sk-ant-...",
  "keys.showToggle": "보기",
  "keys.hideToggle": "숨기기",
  "keys.save": "저장",
  "keys.guideToggleClosed": "API 키는 어떻게 받나요?",
  "keys.guideToggleOpen": "가이드 닫기",
  "keys.youtubeGuide":
    'Google Cloud Console에 접속 → 새 프로젝트 생성 → "APIs & Services > Library"에서 YouTube Data API v3 검색 후 활성화 → "Credentials > Create credentials > API key" 클릭 → 생성된 키 복사.',
  "keys.anthropicGuide":
    'Anthropic Console에 접속 → 계정 생성 후 결제 수단 등록 → "API Keys > Create Key" 클릭 → 생성된 키 복사. (사용량에 따라 과금됩니다)',
  "keys.youtubeGuideLink": "Google Cloud Console 열기",
  "keys.anthropicGuideLink": "Anthropic Console 열기",
  "keys.deleteAll": "모든 데이터 삭제",
  "keys.deleteConfirmTitle": "모든 데이터를 삭제할까요?",
  "keys.deleteConfirmBody":
    "입력한 API 키와 저장된 모든 분석 결과·메타 캐시가 삭제됩니다. 되돌릴 수 없습니다.",
  "keys.deleteConfirmAction": "삭제",
  "keys.deleteCancel": "취소",

  "url.label": "YouTube 영상 URL",
  "url.placeholder": "https://www.youtube.com/watch?v=...",
  "url.submit": "분석 시작",
  "url.errorInvalidDomain": "YouTube URL이 아닙니다",
  "url.errorInvalidVideo": "올바른 영상 URL이 아닙니다",
  "url.errorPlaylist": "영상 URL만 지원합니다 (플레이리스트 불가)",
  "url.errorChannel": "영상 URL만 지원합니다",

  "meta.previewTitle": "분석할 영상",
  "meta.channelLabel": "채널",
  "meta.commentCountLabel": "댓글",
  "meta.commentCountFormat": "{count}개",
  "meta.metaLoadError": "영상 정보를 불러올 수 없습니다. 그래도 분석을 진행할 수 있습니다.",
  "meta.metaAuthError": "API 키 인증에 실패했습니다. 설정에서 키를 다시 확인해주세요.",

  "progress.fetching": "댓글을 모으고 있어요…",
  "progress.analyzing": "AI가 댓글을 분석하고 있어요…",
  "progress.estimate": "보통 20~30초 정도 걸립니다",
  "progress.cancel": "취소",

  "result.headerJustNow": "방금 분석 · 댓글 {count}개 기준",
  "result.headerCached": "{relativeTime} 분석 · 캐시된 결과 · 댓글 {count}개 기준",
  "result.openVideo": "영상 열기",
  "result.disclaimer":
    "AI가 자동으로 분석한 결과입니다. 100% 정확하지 않을 수 있으며 참고용으로 활용해주세요.",
  "result.lowConfidence": "댓글 표본이 적어({count}개) 분석 신뢰도가 낮을 수 있습니다",
  "result.truncatedNotice": "토큰 한도로 좋아요 상위 {count}개 댓글만 분석했습니다",
  "result.languageLabel": "감지된 언어",

  "card.summary": "요약",
  "card.sentiment": "감정 분포",
  "card.strengths": "잘하고 있는 점",
  "card.improvements": "개선할 점",
  "card.keywords": "자주 등장한 키워드",
  "card.notableComments": "주목할 만한 댓글",

  "sentiment.positive": "긍정",
  "sentiment.neutral": "중립",
  "sentiment.negative": "부정",

  "card.emptyStrengths": "뚜렷한 강점 패턴이 발견되지 않았습니다",
  "card.emptyImprovements": "뚜렷한 개선 요구 패턴이 발견되지 않았습니다",
  "card.emptyKeywords": "반복되는 키워드가 충분하지 않습니다",
  "card.emptyNotable": "좋아요가 있는 주목할 댓글이 없습니다",
  "card.evidenceLabel": "근거 댓글",
  "card.evidenceMore": "더 보기",
  "card.evidenceLess": "접기",
  "card.likesFormat": "좋아요 {count}개",

  "empty.commentsDisabledTitle": "댓글이 비활성화된 영상입니다",
  "empty.commentsDisabledBody":
    "이 영상은 댓글이 꺼져 있어 분석할 수 없습니다. 다른 영상으로 시도해보세요.",
  "empty.noCommentsTitle": "분석할 댓글이 없습니다",
  "empty.noCommentsBody": "이 영상에는 아직 댓글이 없습니다. 댓글이 쌓인 후 다시 시도해주세요.",

  "error.retry": "다시 시도",
  "error.editUrl": "URL 수정",
  "error.openSettings": "설정 열기",
  "error.refreshPage": "새로고침",

  "toast.storageFallback": "이 브라우저 모드에서는 키와 캐시가 세션 종료 시 사라집니다",
  "toast.cacheSaveFailed": "분석 결과를 저장하지 못했지만 화면에는 표시됩니다",
  "toast.copied": "복사되었습니다",

  "footer.disclaimer": "이 도구는 YouTube와 Anthropic의 공식 제품이 아닙니다.",
  "footer.privacy":
    "입력한 API 키와 댓글 데이터는 이 브라우저를 떠나 YouTube/Anthropic API 외 다른 서버로 전송되지 않습니다.",
  "footer.source": "소스 코드",

  "boundary.title": "예기치 못한 오류가 발생했습니다",
  "boundary.body": "새로고침으로 복구해주세요.",
  "boundary.refresh": "새로고침",
  "boundary.reportSecondary": "같은 오류가 반복되면 이슈를 남겨주세요",

  "meta.titleDefault": "YouTube 댓글 분석",
  "meta.titleAnalyzing": "분석 중… - YouTube 댓글 분석",
  "meta.titleResult": "{videoTitle} - 분석 결과",
  "meta.description":
    "YouTube 영상의 댓글을 자동으로 분석해 크리에이터를 위한 피드백 리포트를 제공합니다.",

  "relTime.justNow": "방금",
  "relTime.minutesAgo": "{n}분 전",
  "relTime.hoursAgo": "{n}시간 전",
  "relTime.daysAgo": "{n}일 전",
  "relTime.weeksAgo": "{n}주 전",
  "relTime.over30Days": "30일 이상 전",
};

export function t(key: CopyKey, params?: Record<string, string | number>): string {
  const template = copy[key];
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}
