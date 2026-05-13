# Step 9: result-flow-components

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/PRD.md` — 결과 헤더, 카드 빈 상태, 신뢰도, 카피 표
- `/docs/ARCHITECTURE.md` — Dashboard 구조
- `/docs/UI_GUIDE.md` — 카드별 디자인, 차트 가이드, ErrorBanner, EmptyState, 결과 헤더 디자인
- `/docs/ADR.md` — ADR-027 (차트 텍스트 대안, 색 외 표현), ADR-028 (카피), ADR-029 (신뢰도 + 표본 + 면책)

step 1 산출물:
- `src/types/report.ts`, `src/types/videoMeta.ts`, `src/types/errors.ts`

step 2 산출물:
- `src/lib/copy.ts`, `src/lib/relativeTime.ts`

## 작업

결과 흐름 컴포넌트.

### 1. `src/components/Dashboard.tsx`

```tsx
import type { Report } from "@/types/report";
import type { VideoMeta } from "@/types/videoMeta";

type Props = {
  videoId: string;
  videoMeta?: VideoMeta;
  report: Report;
  commentCount: number;
  fromCache: boolean;
  cachedAt?: string;
  truncatedCount?: number;
  onReanalyze: () => void;
};
export default function Dashboard(props: Props): JSX.Element;
```

#### 결과 헤더 (UI_GUIDE 결과 헤더 디자인)

- 좌측: 영상 썸네일 (videoMeta 있을 때) + 제목(`videoMeta?.title ?? videoId`) + 채널(`videoMeta?.channelTitle`)
- 시간/표본 표기:
  - `fromCache && cachedAt` → `t("result.headerCached", { relativeTime: toRelativeKorean(cachedAt), count: commentCount })`
  - 그 외 → `t("result.headerJustNow", { count: commentCount })`
- `t("result.openVideo")` 외부 링크 (`https://www.youtube.com/watch?v={videoId}`, `target="_blank" rel="noopener noreferrer"`)
- `t("result.languageLabel")` + `report.detectedLanguage`
- 우상단: 재분석 버튼 Primary (`t("header.reanalyze")` → `onReanalyze`)

#### 신뢰도 경고 (ADR-029)

- `commentCount < 10` → `t("result.lowConfidence", { count: commentCount })` 노란색 배너 (UI_GUIDE 경고 색 `#f59e0b`)
- `truncatedCount` 있음 → `t("result.truncatedNotice", { count: 100 - (truncatedCount === 50 ? 50 : 0) })` — **단순화**: `t("result.truncatedNotice", { count: 50 })` 고정 (현재 truncation 정책은 50개로 고정)
- 두 경고 동시 노출 가능

#### 카드 그리드

- 모바일 1열 (`grid-cols-1`), 데스크탑 2열 (`md:grid-cols-2`)
- 순서: Summary → SentimentChart → Strengths → Improvements → Keywords → NotableComments
- 모든 카드에 `.fade-in` 클래스

#### 면책 (ADR-029)

- 하단에 `<p class="text-xs text-neutral-500">{t("result.disclaimer")}</p>`

#### 접근성 (ADR-027)

- 마운트 시 Dashboard 컨테이너에 `ref` + `tabIndex={-1}` + `ref.current.focus()` → 스크린리더 안내

### 2~7. 6개 카드 (`src/components/cards/`)

#### `SummaryCard.tsx`
```tsx
type Props = { summary: string };
```
- 카드 제목 `<h3>{t("card.summary")}</h3>`
- 본문 `<p>{summary}</p>`

#### `SentimentChart.tsx`
```tsx
import type { Sentiment } from "@/types/report";
type Props = { sentiment: Sentiment };
```
- Recharts `PieChart` + `Pie` (innerRadius 50%, outerRadius 80%)
- 데이터: `[
  { name: t("sentiment.positive"), value: sentiment.positive, color: "#22c55e" },
  { name: t("sentiment.neutral"), value: sentiment.neutral, color: "#525252" },
  { name: t("sentiment.negative"), value: sentiment.negative, color: "#ef4444" },
]`
- 도넛 중앙 큰 숫자: **가장 높은 sentiment의 비율 + 라벨** (예: 긍정 78% / 부정 65%). 구현: `Math.max(positive, neutral, negative)`로 dominant 식별 → 해당 라벨(`t("sentiment.positive/neutral/negative")`) + 반올림 퍼센트. 동률 시 긍정 우선. 단순 긍정 고정 X — 영상의 dominant tone을 직관적으로 표현해야 함.
- 범례: 라벨 + 색 dot + 퍼센트 (`긍정 78%` 형식)
- 차트 컨테이너 `aria-label={\`감정 분포: 긍정 \${positive}%, 중립 \${neutral}%, 부정 \${negative}%\`}` + `role="img"`
- 시각적으로 숨긴 `<ul class="sr-only">` 텍스트 대안 (3개 항목)
- Tooltip은 단순 텍스트 (그라데이션/그림자 금지)

#### `StrengthsCard.tsx`
```tsx
import type { Strength } from "@/types/report";
type Props = { strengths: Strength[] };
```
- 카드 제목 `<h3>{t("card.strengths")}</h3>`
- 빈 배열 → `<p>{t("card.emptyStrengths")}</p>`
- 각 항목:
  - `<h4>{point}</h4>`
  - `<div>{t("card.evidenceLabel")}</div>`
  - evidence 첫 1개 `<blockquote>{evidence[0]}</blockquote>`
  - 추가 evidence 있으면 `<button>{t("card.evidenceMore")}</button>` (Text 스타일) → 모두 표시 + 라벨 `t("card.evidenceLess")`
  - **펼침 상태는 항목별 컴포넌트 내부 `useState<boolean>(false)`로 관리.** 부모로 끌어올리지 않음 (해당 카드 안에서만 사용).

#### `ImprovementsCard.tsx`
StrengthsCard와 동일 구조. 빈 메시지는 `card.emptyImprovements`. Props 타입은 `Improvement[]` (= `Strength[]` 구조 동일).

#### `KeywordsCard.tsx`
```tsx
import type { Keyword } from "@/types/report";
type Props = { keywords: Keyword[] };
```
- 카드 제목 `<h3>{t("card.keywords")}</h3>`
- 빈 배열 → `t("card.emptyKeywords")`
- 각 태그 (`<span role="img" aria-label="{sentimentKorean} 키워드 {term}, {count}건">`):
  - 색: UI_GUIDE 키워드 색 (pos: `bg-[#22c55e]/15 text-[#22c55e]`, neg: `bg-[#ef4444]/15 text-[#ef4444]`, neu: `bg-neutral-800 text-neutral-300`)
  - 카운트는 라벨 옆 작은 박스 (`bg-neutral-900 px-2 py-0.5 ml-1`)
  - sentiment를 라벨 + 카운트로 전달 (색만으로 의미 전달 금지 — ADR-027)

#### `NotableCommentsCard.tsx`
```tsx
import type { NotableComment } from "@/types/report";
type Props = { items: NotableComment[] };
```
- 카드 제목 `<h3>{t("card.notableComments")}</h3>`
- 빈 배열 → `t("card.emptyNotable")`
- 각 항목:
  - 작성자 (`author || "익명"`) · `t("card.likesFormat", { count: likes })`
  - 본문 3줄까지 (`line-clamp-3`) + 더 보기 토글 (3줄 초과 시)

### 8. `src/components/ErrorBanner.tsx`

```tsx
import type { AppError } from "@/types/errors";

export type ErrorBannerAction = "retry" | "editUrl" | "openSettings" | "refreshPage";

type Props = {
  error: AppError;
  actions: ErrorBannerAction[];
  onAction: (action: ErrorBannerAction) => void;
};
export default function ErrorBanner(props: Props): JSX.Element;
```

- `role="alert"`, 마운트 시 컨테이너 ref.focus() (ADR-027)
- UI_GUIDE ErrorBanner 스타일 (좌측 빨강 4px border + 배경 `bg-[#ef4444]/10`)
- 본문: `error.userMessage`
- 액션 버튼: 각 action에 대해 `t("error.${action}")` 라벨 + `onAction(action)`

### 9. `src/components/EmptyState.tsx`

```tsx
type Props = { reason: "commentsDisabled" | "noComments" };
export default function EmptyState(props: Props): JSX.Element;
```

- `reason === "commentsDisabled"` → `<h2>{t("empty.commentsDisabledTitle")}</h2>` + `<p>{t("empty.commentsDisabledBody")}</p>`
- `reason === "noComments"` → `<h2>{t("empty.noCommentsTitle")}</h2>` + `<p>{t("empty.noCommentsBody")}</p>`
- 중앙 정렬 + UI_GUIDE 빈 상태 톤

### 테스트

- 각 카드별 prop 분기 (빈 데이터, evidence 펼치기, sentiment 색 분기)
- Dashboard 전체 렌더 (mock report, mock videoMeta, fromCache true/false, truncatedCount 분기, lowConfidence 분기)
- ErrorBanner: 각 action 클릭 → 콜백
- EmptyState: 두 reason 분기
- 차트: `aria-label` 검증, `<ul class="sr-only">` 텍스트 대안 존재

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/components/Dashboard.tsx`, `cards/` 6개, `ErrorBanner.tsx`, `EmptyState.tsx` 9개 파일 + 테스트
   - [ ] SentimentChart에 `aria-label` + sr-only 텍스트 대안
   - [ ] 키워드 태그가 색 + 라벨 + 카운트 동시 표시 (색맹 대응)
   - [ ] Dashboard에 면책/신뢰도/truncation 카피 노출
   - [ ] Dashboard fade-in 클래스 적용
   - [ ] 모든 카피 `t()` lookup
3. index.json 업데이트:
   - 성공 → `"summary": "result-flow 9종: Dashboard, 6 cards, ErrorBanner, EmptyState. 차트 텍스트 대안 + 신뢰도 + 면책 + 색 외 표현."`

## 금지사항

- **색만으로 sentiment 의미 전달 금지.** 라벨 동반. 이유: ADR-027.
- **`dangerouslySetInnerHTML` 금지.**
- **차트에 `aria-label` 누락 금지.**
- **fetch 직접 호출 금지.**
- **evidence/요약 등 LLM 출력을 변형 금지** (services에서 이미 필터/마스킹됨). 이유: 단일 책임.
- **services import 금지** (types/lib만). 이유: 의존 방향.
