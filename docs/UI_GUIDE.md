# UI 디자인 가이드

## 디자인 원칙
1. 도구처럼 보여야 한다 — 마케팅 페이지가 아니라 매일 쓰는 분석 대시보드.
2. 신호 우선 — 차트와 카드는 데이터를 드러내기 위한 것. 장식 금지.
3. 좌측 정렬 기본 — 중앙 정렬은 빈 상태/로딩에 한정.
4. 마이크로 카피는 PRD.md 카피 표에서 가져온다. 컴포넌트 안에서 즉흥 문구 작성 금지.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | AI 랜딩 페이지 장식 |

## 색상

### 배경
| 용도 | 값 |
|------|------|
| 페이지 | #0a0a0a |
| 카드 | #141414 |
| 입력/모달 어두운 표면 | neutral-900 |
| 경계선 | neutral-800 |

### 텍스트
| 용도 | 값 |
|------|------|
| 주 텍스트 | text-white |
| 본문 | text-neutral-300 |
| 보조 | text-neutral-400 |
| 비활성 | text-neutral-500 |

### 데이터/시맨틱 색상
| 용도 | 값 |
|------|------|
| 긍정 | #22c55e |
| 부정 | #ef4444 |
| 중립 | #525252 |
| 경고(낮은 신뢰도) | #f59e0b |

**색만으로 정보를 전달하지 마라.** sentiment를 표시할 때는 색 + 라벨(`긍정`/`부정`/`중립`)을 함께 보여준다. 차트 도넛 옆에는 라벨 범례를 반드시 둔다.

## 컴포넌트

### 카드
```
rounded-lg bg-[#141414] border border-neutral-800 p-6
```

### 버튼
```
Primary: rounded-lg bg-white text-black hover:bg-neutral-200 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]
Text:    text-neutral-500 hover:text-neutral-300 text-sm min-h-[44px]
Danger:  rounded-lg bg-[#ef4444] text-white hover:bg-[#dc2626] px-4 py-2 text-sm font-medium min-h-[44px]
```

### 입력 필드
```
rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none min-h-[44px]
```

### 인터랙티브 element 공통: focus ring
```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-white/40
focus-visible:ring-offset-2
focus-visible:ring-offset-[#0a0a0a]
```
**모든 클릭/탭 가능한 element에 적용. 키보드 사용자의 현재 위치가 항상 보여야 한다.**

### 터치 영역
- 최소 44×44 px (`min-h-[44px]`, 필요시 `min-w-[44px]`)
- 모바일에서 인접 버튼은 8px 이상 간격

## 레이아웃

### 너비 / 간격
- 전체 너비: max-w-5xl, mx-auto
- 정렬: 좌측 정렬 기본 (중앙 정렬은 빈 상태/로딩 한정)
- 간격: gap-3~4, 섹션 간 space-y-8
- 페이지 패딩: px-6 py-10

### 반응형 (Tailwind)
- `sm: 640px` / `md: 768px` / `lg: 1024px`
- Dashboard 그리드:
  - 모바일(< 640px): `grid-cols-1` — 카드 1열
  - 태블릿(640~1024): `md:grid-cols-2` — 카드 2열
  - 데스크탑(≥ 1024): `lg:grid-cols-2` — 카드 2열, 큰 카드는 `lg:col-span-2`
- 모바일 카드 순서 (DOM 순서 그대로): Summary → SentimentChart → Strengths → Improvements → Keywords → NotableComments
- **가로 스크롤 절대 금지** — 어떤 상태에서도 `overflow-x` 발생 시 디자인 결함

### iOS 안전 영역
- 푸터에 `pb-[env(safe-area-inset-bottom)]`
- viewport meta: `viewport-fit=cover` 필수

## 타이포그래피
| 용도 | 스타일 |
|------|--------|
| 페이지 제목 | text-4xl font-semibold text-white |
| 섹션 제목 | text-lg font-medium text-white |
| 카드 제목 | text-sm font-medium text-neutral-400 |
| 본문 | text-sm text-neutral-300 leading-relaxed |
| 보조 텍스트 | text-xs text-neutral-500 |
| 인용(evidence 댓글) | text-sm text-neutral-300 italic border-l-2 border-neutral-700 pl-3 |

### 시맨틱 태그 매핑
- 페이지 제목 → `<h1>`
- 섹션 제목 → `<h2>`
- 카드 제목 → `<h3>`
- 본문 → `<p>`
- 댓글 인용 → `<blockquote>`
- 키워드 태그 → `<span>` 안의 텍스트 + 시맨틱 라벨 (`role="img"` + `aria-label="긍정 키워드: 편집"`)

## 애니메이션

- fade-in (0.4s ease-out) — 리포트 카드 로드 시
- 그 외 모든 애니메이션 금지 (특히 hover scale, glow, bounce, spin은 spinner만 허용)

### prefers-reduced-motion
**필수**. `index.css`에 박는다:
```css
@media (prefers-reduced-motion: reduce) {
  .fade-in {
    animation: none;
  }
  *,
  *::before,
  *::after {
    transition: none !important;
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

## 아이콘

- SVG 인라인, strokeWidth 1.5
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 마라
- 크기: 16px (인라인) / 20px (버튼 안)
- 장식용 아이콘은 `aria-hidden="true"` + 텍스트 라벨로 의미 전달
- 의미 있는 아이콘(예: 설정 톱니바퀴 단독)은 `aria-label` 필수

## 접근성 체크리스트

- [ ] 모든 인터랙티브 element에 `focus-visible:ring`
- [ ] 모든 버튼/탭 영역 ≥ 44×44 px
- [ ] 색상 외에 라벨/패턴으로 의미 전달
- [ ] 색상 대비 WCAG AA (text-neutral-300 위 #141414 = 11.2:1 OK)
- [ ] 차트 옆에 시각적으로 숨긴 `<ul>` 텍스트 대안
- [ ] 이미지/썸네일에 `alt` 또는 `aria-label`
- [ ] 모달은 focus trap + ESC (단 needs_keys 모달은 ESC 무효)
- [ ] 진행 상태는 `aria-live="polite"`, 에러는 `aria-live="assertive"` / `role="alert"`
- [ ] 페이지 첫 진입 시 `<h1>` 1개 존재
- [ ] 인터랙티브 element는 `<button>` 또는 `<a>` (div + onClick 금지)

## 차트 가이드 (Recharts)

- 도넛 차트 (SentimentChart):
  - 색: 긍정 #22c55e / 중립 #525252 / 부정 #ef4444
  - innerRadius 50%, outerRadius 80%
  - **가운데 큰 숫자**: 가장 높은 sentiment의 비율 + 라벨 (예: "긍정 78%", "부정 65%"). 단순 긍정 고정 X — 영상의 dominant tone을 직관적으로 표현. 동률 시 긍정 우선.
  - 범례는 차트 옆 또는 아래에 라벨 + 색 + 퍼센트 (`긍정 78%` 형태)
  - `aria-label` + `role="img"` + 차트 옆 `<ul class="sr-only">` 텍스트 대안
- hover tooltip은 단순 텍스트만 (그라데이션/그림자 금지)

## 시각적으로 숨김 (sr-only)
- Tailwind의 `sr-only` 클래스 사용
- aria-live 영역, 차트 텍스트 대안에 적용

## 페이지 메타
- favicon: `/public/favicon.svg` (단순 아이콘, 다크 배경 호환)
- meta description: PRD `meta.description` 키
- viewport: `width=device-width, initial-scale=1, viewport-fit=cover`

## 카드별 디자인 메모

### SummaryCard
- 영상 요약 한두 문장
- `result.disclaimer`는 Dashboard 하단에 있으므로 여기엔 없음
- 우상단에 `result.languageLabel` + 감지된 언어 (예: "감지된 언어 한국어")

### SentimentChart
- 도넛 + 라벨 범례 + 시각적으로 숨긴 텍스트 대안
- 단일 극단(100% 한쪽)도 그대로 표시

### StrengthsCard / ImprovementsCard
- Top 3-5 항목, 각 항목은 `point` + `evidence` 목록
- evidence는 기본 첫 1개만 노출, "더 보기" 버튼으로 펼침
- 빈 배열일 때 `card.emptyStrengths` / `card.emptyImprovements` 표시
- 인용은 `<blockquote>` 시맨틱

### KeywordsCard
- 태그 형태 (`rounded-full px-3 py-1 text-xs`)
- 색: pos → `bg-[#22c55e]/15 text-[#22c55e]`, neg → `bg-[#ef4444]/15 text-[#ef4444]`, neu → `bg-neutral-800 text-neutral-300`
- 각 태그 옆 작은 카운트 (`bg-neutral-900 px-2 py-0.5`)
- 색 단독이 아닌 라벨 + 카운트로도 의미 전달

### NotableCommentsCard
- 좋아요 상위 5-10개
- 각 항목: 작성자 · 좋아요 수 · 본문 (3줄까지, 더 보기로 펼침)
- 작성자 익명은 "익명"

## 결과 헤더 디자인

```
[영상 썸네일]  [영상 제목]                        [재분석 버튼]
              [채널명]
              [방금 분석 · 댓글 87개 기준 / 영상 열기]
              [감지된 언어: 한국어]
```

- 댓글 < 10일 때 그 아래에 `result.lowConfidence` 노란색(#f59e0b) 배너
- truncation 발생 시 같은 자리에 `result.truncatedNotice`
- 우측 상단에 "재분석" 버튼 (Primary 스타일)

## Footer 디자인

- 좌측 정렬, max-w-5xl
- 3개 항목 수직 배치, 보조 텍스트 색 (text-neutral-500)
- 외부 링크는 `target="_blank" rel="noopener noreferrer"` + 외부 링크 아이콘 (`↗` 또는 SVG)
- 하단 안전 영역 패딩

## ErrorBanner 디자인

- 좌측에 빨강 세로 줄 4px (`border-l-4 border-[#ef4444]`)
- 배경: `bg-[#ef4444]/10`
- 본문 `text-neutral-200`
- 우측에 복구 동선 버튼 (Text 스타일)

## OfflineBanner 디자인

- 페이지 상단에 sticky 가로 배너
- 배경: `bg-[#f59e0b]/15`
- 텍스트: `text-[#f59e0b]`
- 좁은 패딩 (`py-2 px-4`)

## Toast 디자인

- 우측 하단 (모바일은 하단 중앙)
- 배경: `bg-neutral-900 border border-neutral-800`
- 텍스트: `text-neutral-200 text-sm`
- 4초 후 fade-out (reduce-motion 시 즉시 제거)
