# Step 2: offline-and-error-recovery

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/PRD.md` — 사용자 플로우 G (오프라인), E (키 변경), 에러 처리 규칙
- `/docs/ARCHITECTURE.md` — 상태 머신, 에러 타입 계층, OfflineBanner / useOnlineStatus
- `/docs/ADR.md` — ADR-008 (도메인 에러 계층)
- `/phases/0-mvp/verification-report.md` — "오프라인" 3개 + "에러 복구" 3개 항목
- `/tests/e2e/helpers.ts` — mock helper
- `/src/components/OfflineBanner.tsx` — 배너 컴포넌트
- `/src/components/ErrorBanner.tsx` — 에러 + 액션 매핑
- `/src/lib/online.ts` — useOnlineStatus 의 online/offline 이벤트 hook
- `/src/lib/reducer.ts` — `FAILED` / `RESET_ERROR` / `KEYS_SAVED` 분기 (특히 step 0-mvp 의 Finding #4 fix 적용 후 상태 — 분석 파이프라인 에러에서 RESET_ERROR 가 `validating` 으로 재진입)
- `/src/types/errors.ts` — `ClaudeAuthError` (`AI_AUTH`), `YouTubeAuthError` (`YT_AUTH`)

step 0~1 산출물 (이 phase 안):
- `tests/e2e/first-entry.spec.ts`, `tests/e2e/url-input.spec.ts`
- `tests/e2e/analyze-progress.spec.ts`, `tests/e2e/result-detail.spec.ts`
- fixture-few 2종

## 작업

수동 체크리스트 6개 항목 (오프라인 3 + 에러 복구 3) 을 자동화. **src/ 수정 없음.**

### 1. `tests/e2e/offline.spec.ts` (신규)

`test.describe("offline: 네트워크 끊김 처리", ...)` 안에 3개 test:

1. **"오프라인 진입 시 상단 배너가 노출된다"**
   - `await page.goto("/")`
   - 키 입력 + idle 상태 도달 (분석 시작 전)
   - `await page.context().setOffline(true)`
   - OfflineBanner 의 한국어 카피 (`lib/copy.ts` 의 `offline.banner` 또는 동등 키 — 정확한 key 는 코드/PRD 에서 확인) 가 visible
   - role 이나 aria-live region 으로도 검증 권장 (`role="status"` 또는 `aria-live="polite"`)

2. **"분석 중 오프라인 진입 → 진행 중단 + 에러 표시"**
   - 정상 상태에서 분석 시작 → "AI 분석 중…" 진입 (Anthropic mock 지연시켜서 시간 확보)
   - `await page.context().setOffline(true)`
   - 진행 화면이 사라지고 ErrorBanner 가 노출 (`OfflineError.userMessage` = "오프라인입니다. 네트워크 연결을 확인해주세요.")
   - "다시 시도" 같은 액션 버튼은 없거나 비활성 (OfflineError.retriable = false)
   - 동시에 OfflineBanner 도 떠있음 (배너 + 에러 메시지 둘 다)

3. **"온라인 복귀 시 배너가 사라진다"**
   - 2번에 이어서: `await page.context().setOffline(false)`
   - OfflineBanner 가 사라짐 (DOM 에서 제거 또는 visible=false)
   - ErrorBanner 는 사용자가 재시도하기 전까지는 유지됨 (이건 검증 안 함 — 별개 흐름)

### 2. `tests/e2e/error-recovery.spec.ts` (신규)

`test.describe("error-recovery: 인증 에러 복구", ...)` 안에 3개 test:

1. **"잘못된 Anthropic 키로 분석 → AI_AUTH 에러 → 설정 모달이 자동 오픈된다"**
   - Anthropic mock 을 401 응답으로 교체:
     ```ts
     await page.route(/api\.anthropic\.com\/v1\/messages/, (route) =>
       route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) })
     );
     ```
   - YouTube meta + comments 는 정상 mock 유지
   - 키 입력 + URL + "분석 시작" → 분석 진행 → 401 → `ClaudeAuthError`
   - ErrorBanner 노출 + `keys.modalTitle` (또는 edit 모달 헤딩) 자동 노출 검증

2. **"키 수정 후 저장 → idle 이 아니라 분석 직전 상태로 복귀한다"**
   - 1번 흐름에 이어서:
   - 자동 오픈된 설정 모달에서 키를 새 값으로 갱신 + "저장"
   - **`idle` 이 아니라 `metaReady` 로 복귀** 검증 (URL 입력 필드에 직전 URL 이 남아있고, VideoMetaPreview 와 "분석 시작" 버튼 노출)
   - URL 이 비워졌거나 메타 카드가 사라지면 회귀
   - 근거: `reducer.ts::KEYS_SAVED` 의 `state.error 분기 → state.previous` 복귀 로직

3. **"분석 파이프라인 에러 후 '다시 시도' 클릭 → 분석이 재개된다 (Finding #4 회귀 락)"**
   - Anthropic mock 을 **첫 호출만 5xx** 로 응답하도록 만든 다음, 두 번째 호출은 정상 응답:
     ```ts
     let calls = 0;
     await page.route(/api\.anthropic\.com\/v1\/messages/, (route) => {
       calls += 1;
       if (calls === 1) route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ type: "error", error: { type: "api_error", message: "server" } }) });
       else fulfillJson(route, claudeReport);
     });
     ```
   - 분석 → 500 → 내부 retry 도 500 (3회) → ClaudeServerError → ErrorBanner
   - **"다시 시도" 클릭 → `validating` 으로 재진입 → 정상 분석 → 결과 카드 도착**
   - DevTools 없이 검증할 수 있는 신호: `messages` 요청 카운트 증가 (route 핸들러의 calls 변수 확인)
   - 0-mvp Finding #4 fix 가 깨지면 이 test 가 FAIL — 회귀 락

> 주: 1번 test 는 `route.fulfill` 의 status 와 body 구조가 Anthropic SDK 가 `AuthenticationError` 로 인식하는 정확한 형태여야 함. 모르면 SDK 소스 보고 맞춰라. `Anthropic.AuthenticationError` 가 status 401 + 특정 body shape 에서 throw 되는 것이 일반적.

### 3. `phases/0-mvp/verification-report.md` 갱신

"오프라인" 3개 + "에러 복구" 3개 항목 = 6개 `[x]` + 매핑.

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
npx playwright test
```

- 빌드/린트/유닛 PASS
- Playwright: 기존 19 (step 0~1) + 신규 6 = **총 25 test PASS**
- verification-report "오프라인" + "에러 복구" 섹션 모두 `[x]`

## 검증 절차

1. AC 실행
2. 체크리스트:
   - [ ] `tests/e2e/offline.spec.ts` 3개 test 작성
   - [ ] `tests/e2e/error-recovery.spec.ts` 3개 test 작성
   - [ ] verification-report 6개 항목 `[x]` + 매핑
   - [ ] Playwright 25 PASS, unit 회귀 없음
3. index.json step 2 갱신:
   - 통과 → `"summary": "offline + error-recovery e2e (총 6 test), navigator.onLine mocking + 401/5xx 분기 + Finding #4 회귀 락"`

## 금지사항

- `src/` 수정 금지. 이유: 회귀 테스트 추가만. Finding #4 fix 는 이미 0-mvp 에서 적용됨.
- 실제 API 호출 금지.
- `context.setOffline(true)` 호출 후 다음 test 영향 안 가게 cleanup 보장. `beforeEach` 에서 `setOffline(false)` 또는 새 context 시작 권장. 이유: test 격리.
- 401 응답 body 구조를 임의로 만들지 마라. SDK 가 `AuthenticationError` 로 인식하지 못하면 NetworkError 등으로 분기돼서 다른 에러가 나옴. 이유: 정확한 분기 검증.
- 3번 test 의 retry 검증에서 정확한 호출 횟수를 검증하지 마라 (Anthropic SDK 내부 retry + 우리의 withRetry 가 겹쳐서 정확한 카운트는 환경 의존적). "에러 후 → 다시 시도 → 결과 도착" 의 결과만 보면 충분. 이유: flaky 회피.
