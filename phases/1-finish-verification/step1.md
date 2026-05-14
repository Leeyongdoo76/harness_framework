# Step 1: analyze-result-cache

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/PRD.md` — 사용자 플로우 B (분석), C (캐시 히트), 결과 화면 명세, 카피 표 (`progress.*`, `result.*`)
- `/docs/ARCHITECTURE.md` — 상태 머신 (특히 `validating` / `fetching` / `analyzing` / `result` 전이), 캐시 정책
- `/phases/0-mvp/verification-report.md` — "분석" 3개 + "결과" 4개 항목 (이 step 이 cover 할 대상)
- `/tests/e2e/helpers.ts` — 기존 mock helper
- `/tests/e2e/smoke.spec.ts` / `tests/e2e/hash-restore.spec.ts` — 분석 흐름 / 캐시 hit 시연 패턴
- `/tests/fixtures/claude-report.json` — 기본 fixture (low-confidence 변형 추가 필요)
- `/tests/fixtures/youtube-comments.json` — 댓글 50개 fixture (low-confidence 용 < 10 변형 추가 필요)
- `/src/components/Dashboard.tsx` — 결과 헤더 + 면책 카피 + low confidence 경고 분기
- `/src/components/ProgressIndicator.tsx` — 진행 2단계 텍스트
- `/src/lib/copy.ts` — `progress.fetchingLabel`, `progress.analyzingLabel`, `result.disclaimer`, `result.headerCached`, `result.lowConfidence` 등
- `/src/lib/cache.ts` — `report:{videoId}` 캐시 구조 + TTL

step 0 산출물 (이 phase 안):
- `tests/e2e/first-entry.spec.ts`
- `tests/e2e/url-input.spec.ts`
- (선택) `tests/e2e/helpers.ts` 에 `enterKeysOnly` 추가됨

## 작업

수동 체크리스트 7개 항목 (분석 3 + 결과 4) 을 자동화. **src/ 코드는 손대지 않는다.** 새 fixture 변형 2개 추가 + Playwright spec 2개 추가.

### 1. 신규 fixture 2개

#### `tests/fixtures/youtube-comments-few.json` (신규)

기존 `youtube-comments.json` 과 동일 구조이되 **댓글 5개만** 포함. `< 10` 조건을 트리거해서 lowConfidence 경고가 노출되도록 만든다.

```json
{
  "items": [
    { "id": "Ugx1", "snippet": { "topLevelComment": { "snippet": { "textOriginal": "댓글1", "authorDisplayName": "u1", "likeCount": 1 } } } },
    /* 5개 */
  ]
}
```

#### `tests/fixtures/claude-report-few.json` (신규)

`claude-report.json` 과 동일 구조. `content[0].text` 의 inner JSON 의 `notableComments` 등이 댓글 5개에 맞춰 일관성을 유지. (evidence 가 위 fixture 의 댓글 텍스트 중 하나여야 evidence filter 가 안 날림.)

### 2. `tests/e2e/analyze-progress.spec.ts` (신규)

`test.describe("analyze: 진행 + 취소", ...)` 안에 2개 test:

1. **"진행 표시가 두 단계로 전환된다 (댓글 수집 → AI 분석)"**
   - mockAll 적용 — 단, commentThreads 응답을 약간 지연 (`route.fulfill` 호출 전 `await new Promise(r => setTimeout(r, 300))`) 시켜서 fetching 상태가 관찰 가능하게.
   - 키 입력 + URL + "분석 시작" 클릭
   - `progress.fetchingLabel` ("댓글 모으는 중…") 카피 노출 확인
   - 이후 `progress.analyzingLabel` ("AI 분석 중…") 카피로 전환되는 것 확인 (`expect.poll` 사용)
   - 최종 결과 카드 도착

2. **"취소 버튼을 누르면 분석이 중단되고 idle 로 복귀한다"**
   - mockAll 적용 — 단, **Anthropic 응답을 무한 지연** (route handler 가 `fulfill` 을 호출하지 않고 대기)
   - 키 입력 + URL + "분석 시작" 클릭
   - "AI 분석 중…" 단계 진입 wait
   - "취소" 버튼 클릭 (`getByRole("button", { name: "취소" })`)
   - 결과 헤더가 사라지고 URL 입력 화면 (`url.label` 라벨 노출) 으로 복귀

### 3. `tests/e2e/result-detail.spec.ts` (신규)

`test.describe("result: 결과 디테일", ...)` 안에 4개 test:

1. **"결과 헤더에 분석 시점 + 표본 크기가 표시된다"**
   - smoke 처럼 키 입력 + 분석 완료까지 진행
   - "방금 분석 · 댓글 50개 기준" 같은 패턴 검증 (`/방금 분석.*댓글 \d+개 기준/`)
   - smoke 가 부분 cover 하지만 패턴 정밀화 — 시간 라벨 + 댓글 수 라벨 둘 다 존재

2. **"면책 카피가 결과 화면 하단에 노출된다"**
   - 결과 도착 후 `result.disclaimer` ("AI가 자동으로 분석한 결과입니다...") 카피 visible
   - 결과 카드들 아래쪽에 위치하는지는 검증 안 함 (DOM 순서 / 시각적 위치는 사람 판단 영역)

3. **"댓글 수 < 10 이면 lowConfidence 경고가 노출된다"**
   - mock 을 fixture-few 로 교체: youtube-comments-few.json + claude-report-few.json
   - 분석 완료까지 wait
   - `result.lowConfidence` 카피 노출 확인 (`lib/copy.ts` 에서 정확한 텍스트 가져오기)

4. **"캐시 히트 시 헤더가 '{시간} 전 분석 · 캐시된 결과' 형태로 노출되고 재분석이 강조된다"**
   - 분석 1회 완료해서 cache 생성
   - 모킹 해제 또는 별도 page 컨텍스트에서 (캐시 hit 검증을 위해 fresh fetch 차단):
     - Anthropic mock 제거
     - commentThreads mock 제거
     - meta mock 만 유지
   - `page.reload()` 또는 동일 hash 로 진입
   - `result.headerCached` 패턴의 카피 노출 (예: "방금 분석 · 캐시된 결과 · 댓글 50개 기준")
   - "재분석" 버튼이 시각적으로 강조됐는지는 사람 판단 영역 — 여기선 **버튼 존재만** 검증 (`getByRole("button", { name: "재분석" })`)

> 주: 4번 test 는 `hash-restore.spec.ts` 와 겹치는 부분 있음. 중복 피하려면 `hash-restore.spec.ts` 가 이미 cover 하는 `kind: "result"` + fromCache=true 진입은 그대로 두고, 본 test 는 **카피 패턴 + 재분석 버튼 존재** 에 집중.

### 4. `phases/0-mvp/verification-report.md` 갱신

"분석" 3개 + "결과" 4개 항목 7개를 `[x]` 마킹 + 매핑 주석.

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
npx playwright test
```

- 빌드/린트/유닛 PASS
- `npx playwright test`: 기존 13 (step 0 까지) + 신규 6 = **총 19 test PASS**
- verification-report 의 "분석" + "결과" 섹션 모든 항목 `[x]`

## 검증 절차

1. AC 실행
2. 체크리스트:
   - [ ] `tests/fixtures/youtube-comments-few.json` 댓글 5개 fixture 생성
   - [ ] `tests/fixtures/claude-report-few.json` 일치하는 report 생성
   - [ ] `tests/e2e/analyze-progress.spec.ts` 2개 test 작성
   - [ ] `tests/e2e/result-detail.spec.ts` 4개 test 작성
   - [ ] `verification-report.md` 7개 항목 `[x]` + 매핑
   - [ ] Playwright 19 PASS, unit 회귀 없음
3. `phases/1-finish-verification/index.json` 의 step 1 status 갱신:
   - 통과 → `"summary": "analyze-progress + result-detail e2e (총 6 test) + fixture-few 2종 추가, verification-report 7개 항목 자동 검증 마킹"`

## 금지사항

- `src/` 수정 금지. 이유: 회귀 테스트 추가만.
- 실제 API 호출 금지. mock 만 사용. 이유: BYOK.
- "취소" 검증 시 **Anthropic mock 을 무한 지연**시킨 다음 cleanup 확실히. timeout 누수 방지. 이유: 다음 test 영향.
- fixture-few 의 댓글 텍스트가 fixture-few claude-report 의 evidence 와 일치해야 함. 안 그러면 evidence filter 가 다 날려서 strengths/improvements 가 빈 배열이 됨 → 결과 화면이 비어 보임. 이유: `lib/analyze.ts` 의 hallucinated evidence filter 동작.
- 캐시 hit test 에서 fresh fetch (Anthropic / commentThreads) 가 호출되지 않는 것도 검증 추가 권장 (`page.on("request")` 로 도메인 카운트). 이유: 캐시 hit 이 진짜로 캐시에서 왔는지 보장.
- 신규 fixture 파일명 `*-few.json` 명명 규칙 유지. 이유: 일관된 명명으로 추후 추가 fixture (예: `*-empty.json`) 와 충돌 회피.
