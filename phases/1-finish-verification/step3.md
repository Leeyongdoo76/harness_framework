# Step 3: a11y-and-page-meta

## 읽어야 할 파일

- `/CLAUDE.md` — 접근성 CRITICAL 섹션
- `/docs/PRD.md` — 비기능 요구 (접근성), 사용자 플로우의 hash 갱신 시점, 페이지 메타 규칙
- `/docs/ARCHITECTURE.md` — focus management, aria-live, 페이지 title 관리
- `/docs/UI_GUIDE.md` — focus ring, 시맨틱 태그, 차트 가이드
- `/phases/0-mvp/verification-report.md` — "접근성" 7개 + "페이지 메타" 3개 항목
- `/tests/e2e/helpers.ts`
- `/src/lib/focusTrap.ts` — focus trap hook
- `/src/lib/pageTitle.ts` — title 동기화 hook
- `/src/lib/urlHash.ts` — hash 갱신 시점
- `/src/components/ApiKeyModal.tsx` — focus trap 대상
- `/src/components/cards/SentimentChart.tsx` — 차트 + 라벨 + 텍스트 대안
- `/src/components/cards/KeywordsCard.tsx` — 키워드 태그 sentiment 표현

step 0~2 산출물 (이 phase 안): 기존 spec 들 + 신규 e2e 25개

## 작업

접근성 7개 중 **자동화 가능한 5개** + 페이지 메타 3개 = 총 8개 항목 자동화. **src/ 수정 없음.**

> 자동화 불가 (사람 판단 영역): focus ring 가시성, Tab 만으로 모든 동작 가능 (시각 흐름 판단) — step 4 의 잔여 큐레이션 항목으로 분리.

### 1. `tests/e2e/a11y.spec.ts` (신규)

`test.describe("a11y: 접근성", ...)` 안에 5개 test:

1. **"모달 focus trap — Tab / Shift+Tab 이 모달 안에서 wrap 된다"**
   - 키 입력 모달 (needs_keys) 열린 상태에서:
   - `Tab` 키를 모달의 focusable 원소 개수만큼 반복 누름 → 첫 번째 원소로 wrap
   - `Shift+Tab` 도 반대 방향으로 wrap
   - `document.activeElement` 가 항상 모달 내부 원소인지 검증 (`page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)`)

2. **"needs_keys 모달은 ESC 로 닫히지 않는다"** (step 0 의 #2 와 일부 겹치지만 ESC 동작 단독 검증)
   - needs_keys 모달 노출 상태
   - `Escape` → 모달 여전히 visible
   - (step 0 은 ESC + 배경클릭 묶음 — 여기는 ESC 단독)

3. **"edit (설정) 모달은 ESC 로 닫힌다"**
   - 키 입력 완료 → idle → 헤더 "설정" 클릭 → 설정 모달 (edit 모드) 노출
   - `Escape` → 모달 사라짐, idle 화면 복귀
   - 이게 `needs_keys` 와의 핵심 차이 검증

4. **"prefers-reduced-motion: reduce 환경에선 fade-in transition 이 비활성화된다"**
   - `await page.emulateMedia({ reducedMotion: "reduce" })`
   - 키 입력 + 분석 완료까지
   - 결과 카드 중 하나의 computed style 검증:
     - `transition` 속성이 `none` / `0s` 이거나
     - `animation-duration` 이 `0s`
   - 정확한 selector 는 SentimentChart 또는 SummaryCard 의 wrapper. 코드 보고 결정.
   - 보조 검증: 동일 흐름을 `reducedMotion: "no-preference"` 로 실행했을 때는 transition 속성이 0 이 아님 (대비)

5. **"sentiment 차트가 색뿐 아니라 라벨 + 퍼센트 텍스트도 노출한다"**
   - 결과 도착 후 SentimentChart 영역에서:
   - "긍정 78%", "중립 15%", "부정 7%" 같은 텍스트가 보임 (라벨 + 숫자 동시)
   - 정확한 카피는 `lib/copy.ts` 의 `sentiment.positive/neutral/negative` 또는 동등 키 확인
   - **색맹 시뮬레이션 자체 검증은 사람-판단 영역** — 여기서는 텍스트가 존재한다는 사실만 자동 검증

#### 추가: 키워드 태그 sentiment 라벨 (별도 test 로 분리해도 되고 위 5번에 묶어도 됨)

6. **"키워드 태그가 sentiment 라벨 (긍정/중립/부정) 텍스트도 함께 표시한다"** (선택 — 6개 test 까지 늘려도 OK)
   - 결과 화면의 KeywordsCard 영역
   - 각 키워드 카드에 라벨 텍스트 ("긍정" / "중립" / "부정") 가 색과 별도로 노출

### 2. `tests/e2e/page-meta.spec.ts` (신규)

`test.describe("page-meta: title + hash", ...)` 안에 3개 test:

1. **"분석 중에 document.title 이 '분석 중… - YouTube 댓글 분석' 로 변한다"**
   - mockAll 적용, Anthropic mock 지연 시켜서 analyzing 상태 시간 확보
   - 키 입력 + URL + "분석 시작"
   - "분석 중…" 진입 wait
   - `await page.title()` → `meta.titleAnalyzing` 카피 값과 일치

2. **"결과 도착 시 document.title 이 '{영상 제목} - 분석 결과' 로 변한다"**
   - 위 흐름 결과 카드 도착까지 wait
   - `await page.title()` → `"테스트 영상 제목 - 분석 결과"` (또는 동등 카피)
   - title 에 영상 제목이 포함되는지만 검증 (정확한 포맷은 `meta.titleResult` 카피 참조)

3. **"URL hash 가 '분석 시작' 클릭 직후 즉시 갱신된다 (결과 도착 후가 아니라)"**
   - mockAll 적용, **commentThreads + Anthropic 둘 다 무한 지연**시켜서 분석 진행 중 상태 유지
   - 키 입력 + URL 입력 + "분석 시작" 클릭
   - 즉시 (분석 결과 도착 전) `expect.poll(() => page.url())` 가 `/#v=dQw4w9WgXcQ/` 매치
   - 결과 도착 전에 hash 가 이미 갱신돼있어야 함 (ADR-026)

### 3. `phases/0-mvp/verification-report.md` 갱신

- 접근성: 자동화 가능 5~6개를 `[x]` + 매핑. 나머지 (focus ring 가시성, Tab 만으로 모든 동작 가능, OS prefers-reduced-motion 진짜 토글) 는 step 4 가 큐레이션할 잔여 항목으로 표시 (예: `[ ] focus ring 가시 ← step 4 manual pass`).
- 페이지 메타: 3개 모두 `[x]` + 매핑.

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
npx playwright test
```

- 빌드/린트/유닛 PASS
- Playwright: 기존 25 + 신규 약 8 = **총 약 33 test PASS** (구체 개수는 6번 test 포함 여부에 따라)
- verification-report 접근성 5~6 + 페이지 메타 3 항목 `[x]`
- 잔여 접근성 항목은 step 4 manual pass 로 명시적 마킹

## 검증 절차

1. AC 실행
2. 체크리스트:
   - [ ] `tests/e2e/a11y.spec.ts` 5~6 test
   - [ ] `tests/e2e/page-meta.spec.ts` 3 test
   - [ ] verification-report 갱신 (자동화된 항목 `[x]`, 잔여는 step 4 라벨)
   - [ ] Playwright 약 33 PASS
3. index.json step 3 갱신:
   - 통과 → `"summary": "a11y (focus trap + ESC 분기 + reduced-motion + sentiment 라벨) + page-meta (title + hash 시점) e2e 추가, 자동화 가능한 8개 항목 [x]"`

## 금지사항

- `src/` 수정 금지.
- focus trap test 에서 정확한 focusable 개수를 하드코딩하지 마라. `await page.locator('[role="dialog"] :focus').count()` 같이 동적으로. 이유: 모달의 input 개수가 바뀌면 깨짐.
- reduced-motion test 에서 transition 속성을 정확히 어떤 selector 에서 측정할지는 코드 보고 결정. 임의 selector 쓰지 마라. 이유: 컴포넌트 구조 변화에 brittle.
- 색맹 시뮬레이션 시각 검증은 시도 금지 — 사람 판단. step 4 잔여로.
- hash 시점 검증에서 분석이 끝나기 전이라는 사실이 보장돼야 함. mock 을 충분히 길게 지연 (분석이 절대 끝나지 않게) 시키고 검증. 이유: race condition 회피.
- 기존 Playwright spec 의 reduced-motion 환경을 오염시키지 마라. `emulateMedia` 호출은 해당 test 안에서만, beforeEach/afterEach 로 복원. 이유: test 격리.
