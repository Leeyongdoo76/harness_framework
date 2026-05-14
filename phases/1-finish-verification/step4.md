# Step 4: privacy-and-final-pass

## 읽어야 할 파일

- `/CLAUDE.md` — 보안 / BYOK 섹션
- `/docs/PRD.md` — 사용자 플로우 H (ErrorBoundary), 비기능 요구 보안, 카피 표 전체
- `/docs/ARCHITECTURE.md` — API 키 관리, 보안, ErrorBoundary
- `/docs/ADR.md` — ADR-002 (.env 금지), ADR-018 (CSP)
- `/phases/0-mvp/verification-report.md` — "프라이버시" 3개 항목 + step 3 가 남긴 잔여 접근성 항목
- `/tests/e2e/helpers.ts`
- `/src/lib/copy.ts` — SSOT 테스트 대상
- `/src/components/ApiKeyModal.tsx` — 키 마스킹 표현
- `/src/components/ErrorBoundary.tsx` — 외부 송신 0 검증 대상

step 0~3 산출물 (이 phase 안): e2e 약 33 test + 갱신된 verification-report

## 작업

프라이버시 3개 항목 자동화 + copy SSOT unit test 추가 + verification-report 최종 마감 + 사람-전용 잔여 항목 큐레이션.

### 1. `tests/e2e/privacy.spec.ts` (신규)

`test.describe("privacy: 키 / 트래픽 / ErrorBoundary", ...)` 안에 3개 test:

1. **"설정 모달에서 키가 마스킹되어 표시된다 (마지막 4자만 노출)"**
   - 키 입력 + idle 도달
   - 헤더 "설정" 클릭 → edit 모달 노출
   - YouTube 키 필드 / Anthropic 키 필드의 표시값이 마지막 4자만 보이거나 (`••••••a8k2` 패턴) `type="password"` 로 가려져있음
   - 정확한 마스킹 방식 (글자 수 / 패턴) 은 `ApiKeyModal.tsx` 구현 확인 후 검증
   - "보기" 토글 (`keys.showToggle`) 누르면 원문 노출되는지도 검증

2. **"분석 흐름 동안 외부 네트워크 요청이 화이트리스트 도메인 외에는 없다"**
   - `page.on("request", req => requests.push(new URL(req.url())))` 로 모든 요청 수집
   - 키 입력 + 분석 1회 완료
   - 수집된 요청들의 host 집합 검증:
     - 허용: `localhost:5173`, `www.googleapis.com`, `youtube.googleapis.com`, `api.anthropic.com`, `i.ytimg.com` (썸네일)
     - 그 외 host 가 한 개라도 있으면 FAIL
   - `data:` URI 와 `blob:` 은 허용 (썸네일 fallback)

3. **"ErrorBoundary fallback 화면에서 외부 도메인 송신이 0이다"**
   - 강제로 컴포넌트 에러 발생시키기:
     - 옵션 A: `page.evaluate(() => { throw new Error("test") })` 는 ErrorBoundary 가 못 잡음 — 컴포넌트 안에서 throw 가 필요
     - 옵션 B: 분석 결과 fixture 에 ErrorBoundary 가 잡을 만한 비정상 값 주입 — 복잡
     - **권장: ErrorBoundary 의 fallback 을 직접 노출하는 별도 route 또는 storybook 같은 게 없으므로 이 test 는 skip + manual 으로 분리** (또는 component-level test 로 RTL 에서만 검증)
   - **실용적 접근**: 이 test 를 e2e 가 아니라 component test 로 옮긴다 — `src/components/ErrorBoundary.test.tsx` 가 이미 있는지 확인. 있으면 거기에 "fallback 렌더 중 fetch 가 0회 호출됨" 케이스 추가. 없으면 신규 작성.

> 주: 3번 검증은 e2e 보다 RTL 환경이 더 자연스러움. step 4 의 산출물 위치를 유연하게 — e2e 만 고집하지 마라.

### 2. `src/lib/copy.test.ts` 보강 (이미 존재하면 케이스 추가)

목적: PRD 카피 표의 모든 key 가 `lib/copy.ts` 에 정의돼있고 빈 문자열이 아닌지 검증.

```ts
describe("copy SSOT", () => {
  it("PRD 카피 표의 모든 key 가 정의되고 비어있지 않다", () => {
    const REQUIRED_KEYS = [
      "welcome.intro",
      "header.title", "header.settings", "header.reanalyze",
      "status.analysisComplete", "status.fetchingStarted", "status.analyzingStarted", "status.cancelled",
      "keys.modalTitle", "keys.modalIntro", /* ... 전체 키 나열 ... */
      "result.disclaimer", "result.headerCached", "result.lowConfidence",
      "meta.titleDefault", "meta.titleAnalyzing", "meta.titleResult",
      // PRD 카피 표의 모든 key
    ];
    for (const key of REQUIRED_KEYS) {
      const value = t(key as CopyKey);
      expect(value, `copy key missing: ${key}`).toBeTruthy();
      expect(value.length, `copy key empty: ${key}`).toBeGreaterThan(0);
    }
  });
});
```

REQUIRED_KEYS 는 `docs/PRD.md` 의 마이크로 카피 표 섹션을 통째로 훑어서 작성. 새로 추가된 키가 있으면 같이 포함.

### 3. `phases/0-mvp/verification-report.md` 최종 마감

#### 3-a. 프라이버시 3개 항목 마킹

자동화된 2개 + ErrorBoundary 검증은 RTL/component test 또는 manual:
- `[x] 키 표시는 마스킹 (마지막 4자만)` ← tests/e2e/privacy.spec.ts
- `[x] DevTools Network에 키가 다른 도메인으로 전송 안 됨` ← tests/e2e/privacy.spec.ts
- `[x] ErrorBoundary fallback에서 외부 전송 호출 없음` ← src/components/ErrorBoundary.test.tsx (또는 manual)

#### 3-b. 잔여 사람-전용 항목 명시적 큐레이션

verification-report 의 "수동 체크리스트" 섹션 가장 위에 새 sub-section 추가:

```markdown
### 사람-전용 잔여 항목 (자동화 불가, 본인 브라우저 + OS 에서 확인 필요)

이 항목들은 자동 검증으로 cover 가 안 되므로 사용자가 직접 확인해야 합니다.
각 항목 옆에 `[x]` 또는 `[ ] (FAIL 이유)` 를 마킹하세요.

- [ ] **focus ring 가시성** — 키보드 Tab 으로 돌아다닐 때 focus ring 이 모든 인터랙티브 element 에서 명확히 보임 (UI_GUIDE 의 `focus-visible:ring-2 ring-white/40` 규칙)
- [ ] **Tab 만으로 모든 동작 가능** — 마우스 없이 키보드로 처음부터 끝까지 분석 진행 가능
- [ ] **OS prefers-reduced-motion 진짜 동작** — Windows: 설정 > 접근성 > 시각 효과 > "애니메이션 효과" 끄기 / macOS: 시스템 설정 > 손쉬운 사용 > 동작 > "동작 줄이기" 켜기. 그 상태에서 결과 카드 진입 시 fade-in 이 정지하는지
- [ ] **색맹 시뮬레이션** — Chrome DevTools > Rendering > "Emulate vision deficiencies" 에서 Deuteranopia 켠 다음, 결과 화면의 sentiment 차트와 키워드 태그의 의미가 색 없이도 전달되는지
- [ ] **키 마스킹 시각적 자연스러움** — 설정 모달에서 키 마스킹 표현 (`••••••a8k2` 또는 type=password) 이 어색하지 않고 마지막 4자가 잘 보이는지

각 항목을 확인하고 `[x]` 마킹. FAIL 인 항목이 있으면 본 보고서의 "발견 사항" 섹션에 Finding #N 으로 기록 + 우선순위 판정.
```

#### 3-c. 자동/수동 자동 마킹 최종 통계 추가

verification-report 의 상단 "현재 상태" 영역을 갱신:

```markdown
## 현재 상태 (2026-05-XX, 1-finish-verification phase 완료 후)

- 자동 (Playwright): 약 N test PASS (구체 개수는 phase 종료 시점 확인)
- 자동 (vitest): 약 N test PASS
- 수동 체크리스트: 자동화된 N 개 항목 [x], 사람-전용 잔여 5 개 항목 [ ] (위 큐레이션 섹션)
```

### 4. 잔여 항목 사용자 가이드

step 4 가 마지막 step 이므로, 이 step 의 산출물 중 하나는 **사용자가 잔여 항목 5개를 어떻게 확인하는지 명확히 안내** 하는 것. verification-report 의 3-b 섹션이 그 가이드 역할.

사용자가 본 phase 의 execute.py 가 끝난 후 다음을 수행:
1. `phases/0-mvp/verification-report.md` 의 "사람-전용 잔여 항목" 섹션 열기
2. 각 항목을 본인 환경에서 5분 안에 확인
3. `[x]` 또는 `[ ] (FAIL 이유)` 마킹

(이 가이드는 execute.py 의 출력 메시지로도 한 줄 안내 권장 — 이 step 의 commit 메시지나 summary 에 명시.)

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
npx playwright test
```

- 빌드/린트/유닛 PASS
- Playwright: 기존 33 + 신규 2~3 = **총 약 35~36 test PASS** (3번 ErrorBoundary 가 e2e 가 아니라 component 면 e2e 신규는 2개)
- copy SSOT unit test 가 PRD 카피 표의 모든 key 를 cover
- `verification-report.md` 의 모든 자동화 가능한 manual 항목 `[x]` 마킹 + 매핑
- "사람-전용 잔여 항목" 섹션 새로 추가됨 (5개 항목)
- "현재 상태" 통계 갱신

## 검증 절차

1. AC 실행
2. 체크리스트:
   - [ ] `tests/e2e/privacy.spec.ts` 작성 (2~3 test, ErrorBoundary 위치에 따라)
   - [ ] (ErrorBoundary RTL test 가 별도면) `src/components/ErrorBoundary.test.tsx` 갱신
   - [ ] `src/lib/copy.test.ts` 에 SSOT 검증 케이스 추가
   - [ ] `verification-report.md` 의 프라이버시 섹션 `[x]`
   - [ ] `verification-report.md` 에 "사람-전용 잔여 항목" 섹션 추가
   - [ ] `verification-report.md` 의 "현재 상태" 갱신
3. index.json step 4 갱신:
   - 통과 → `"summary": "privacy e2e + copy SSOT + 사람-전용 잔여 항목 5개 큐레이션 + verification-report 최종 마감. 자동 검증으로 cover 안 되는 5개는 사용자 manual pass 대기."`

## 금지사항

- `src/` 의 production 코드 수정 금지. test 코드 / component test 만 추가/수정. 이유: 회귀 테스트 phase 의 단일 책임.
- copy SSOT test 의 REQUIRED_KEYS 를 추측으로 채우지 마라. **PRD.md 의 카피 표 섹션을 처음부터 끝까지 훑어서** 모든 key 를 나열. 빠뜨리면 SSOT 검증 의미 상실. 이유: 실제 SSOT 의무화.
- ErrorBoundary 검증을 e2e 로 억지로 만들지 마라. 컴포넌트 안에서 throw 를 시뮬레이션하기 어려우면 RTL test 로 옮겨라. 이유: 적합한 도구 사용.
- privacy spec 의 "외부 도메인 화이트리스트" 검증 시 `https://i.ytimg.com` 도 허용 도메인에 포함. 이유: 썸네일 로딩 — `index.html` 의 `img-src` CSP 와 일치.
- "사람-전용 잔여 항목" 의 5개 안내 문구를 임의로 줄이거나 추가하지 마라. 위 3-b 의 5개로 정확히 일치. 이유: step 3 가 "잔여" 로 명시한 항목과 동일해야 추적 가능.
- 잔여 항목을 임의로 `[x]` 마킹 금지. 사용자가 직접 확인할 때까지 `[ ]`. 이유: 검증의 신뢰성.
