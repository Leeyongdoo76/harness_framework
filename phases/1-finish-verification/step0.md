# Step 0: shell-and-input-flow

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/PRD.md` — 사용자 플로우 A (첫 진입), B (URL 입력), 카피 표
- `/docs/ARCHITECTURE.md` — 컴포넌트 계층, ApiKeyModal / UrlInput 구조
- `/docs/UI_GUIDE.md` — 모달 디자인 규칙
- `/phases/0-mvp/verification-report.md` — "첫 진입" 5개 + "URL 입력" 4개 항목 (이 step 이 cover 할 대상)
- `/tests/e2e/helpers.ts` — `mockAll`, `mockYouTubeMeta`, `clearStorage`, `enterKeysAndStart`, `SAMPLE_VIDEO_URL`, `SAMPLE_VIDEO_ID`
- `/tests/e2e/smoke.spec.ts` — 기존 e2e 작성 패턴 참고
- `/src/components/ApiKeyModal.tsx` — 모달 구조 + 가이드 토글 + clearAll 버튼
- `/src/components/UrlInput.tsx` — URL 검증 분기 4종
- `/src/lib/clearAll.ts` — 4개 prefix (`keys:`, `report:`, `videometa:`, `flag:`) 삭제 명세
- `/src/lib/copy.ts` — 카피 key → 텍스트 매핑

## 작업

수동 체크리스트 9개 항목 (첫 진입 5 + URL 입력 4) 을 자동화하는 Playwright spec 2개를 추가한다. **src/ 코드는 손대지 않는다** — 회귀 테스트만 추가.

### 1. `tests/e2e/first-entry.spec.ts` (신규)

`test.describe("first-entry: 첫 진입 화면", ...)` 안에 5개 test:

1. **"환영 카피가 1줄로 표시된다"**
   - `await page.goto("/")`
   - `welcome.intro` 카피 (`lib/copy.ts` 의 `welcome.intro` 값) 가 화면에 보임. `getByText` 로 검증.

2. **"needs_keys 모달은 ESC / 배경 클릭으로 닫히지 않는다"**
   - 모달 노출 확인 (`getByRole("dialog", { name: "API 키를 입력해주세요" })`)
   - `await page.keyboard.press("Escape")` → 모달 여전히 visible
   - 모달 바깥 영역 클릭 (예: `page.locator("body").click({ position: { x: 10, y: 10 } })`) → 여전히 visible
   - 단, 키 미입력 상태 유지여야 함 (저장 버튼 disabled 확인으로 간접 검증)

3. **"가이드 토글이 펼침/접힘 한다"**
   - `keys.guideToggleClosed` 텍스트 ("API 키는 어떻게 받나요?") 버튼이 보임
   - 클릭 → `keys.youtubeGuide` 본문이 화면에 노출
   - 다시 클릭 (라벨이 `keys.guideToggleOpen` "가이드 닫기" 로 바뀐 상태) → 본문 사라짐
   - 접근성: 토글 버튼이 `aria-expanded` 속성으로 상태를 노출하는지 확인 (있으면 검증)

4. **"두 키 모두 입력해야 저장 버튼이 활성화된다"**
   - 초기: "저장" 버튼 `disabled`
   - YouTube 키만 입력 → 여전히 `disabled`
   - Anthropic 키도 입력 → `enabled` 로 전환

5. **"모든 데이터 삭제 → 4종 prefix 가 localStorage 에서 사라진다"**
   - mockAll 적용 후 키 입력 + URL 입력 + 분석 1회 완료 (`enterKeysAndStart` + "분석 시작" 클릭 + 결과 카드 wait)
   - 사전 검증: `await page.evaluate(() => Object.keys(localStorage))` 의 결과에 `keys:*`, `report:*`, `videometa:*` 프리픽스가 최소 1개 이상 존재
   - 설정 모달 열기 (헤더 "설정" 버튼)
   - "모든 데이터 삭제" 버튼 클릭 → ConfirmDialog 노출 (`keys.deleteConfirmTitle`)
   - "삭제" 클릭
   - 사후 검증: `await page.evaluate(() => Object.keys(localStorage).filter(k => /^(keys:|report:|videometa:|flag:)/.test(k)))` 결과가 빈 배열
   - 화면이 `needs_keys` 상태로 전환됨 (API 키 모달 재노출)

### 2. `tests/e2e/url-input.spec.ts` (신규)

`test.describe("url-input: URL 검증", ...)` 안에 4개 test. 각 test 는 `clearStorage` + `mockAll` 후 키 입력 완료 상태에서 시작 (`enterKeysAndStart` 의 keys 입력 부분만 따로 떼어 호출하거나 helper 추가).

1. **"잘못된 URL 4종이 각자 다른 인라인 에러를 표시한다"**
   - 4가지 입력 + blur:
     - `https://vimeo.com/12345` → `url.errorInvalidDomain`
     - `https://www.youtube.com/watch?v=short` → `url.errorInvalidVideo`
     - `https://www.youtube.com/playlist?list=PL...` → `url.errorPlaylist`
     - `https://www.youtube.com/@channelname` → `url.errorChannel`
   - 각 케이스마다 해당 카피가 입력 필드 근처에 노출되는지 검증

2. **"blur 또는 Enter 시 메타 호출이 발생한다"**
   - `page.route` 핸들러를 counter 로 감싸서 호출 횟수 측정
   - 정상 URL 입력 후 blur → counter === 1
   - 별도 케이스로 입력 후 Enter → counter === 1
   - (smoke 가 이미 blur 트리거를 부분 검증하지만 Enter 트리거는 신규)

3. **"같은 videoId 를 재입력해도 메타 재호출이 발생하지 않는다"**
   - 정상 URL 입력 후 blur → counter === 1
   - 같은 URL 을 한번 더 입력 (clear 후 다시 fill) + blur → counter 여전히 1

4. **"메타 호출 후 localStorage 에 `videometa:{videoId}` 키가 존재한다"**
   - 정상 URL 입력 후 blur + 메타 도착 wait
   - `await page.evaluate(() => localStorage.getItem("videometa:dQw4w9WgXcQ"))` 가 non-null
   - 파싱해서 `videoMeta` 필드 존재 검증 (구조 검증은 lib/metaCache.ts 의 단위 테스트가 이미 cover — e2e 에선 키 존재만)

### 3. helper 보강 (필요 시)

만약 `enterKeysAndStart` 를 키 입력만 분리해서 쓰고 싶으면 `tests/e2e/helpers.ts` 에 다음을 추가:

```ts
export async function enterKeysOnly(page: Page): Promise<void> {
  await page.getByLabel("YouTube Data API 키").fill("AIza-test-youtube-key");
  await page.getByLabel("Anthropic API 키").fill("sk-ant-test-anthropic-key");
  await page.getByRole("button", { name: "저장", exact: true }).click();
}
```

기존 `enterKeysAndStart` 는 그대로 두고 새 helper 만 export. caller 갱신 불필요.

### 4. `phases/0-mvp/verification-report.md` 갱신

"첫 진입" 5개 + "URL 입력" 4개 항목 = 9개를 `[ ]` → `[x]` 로 변경. 각 항목 뒤에 `← tests/e2e/first-entry.spec.ts` 또는 `← tests/e2e/url-input.spec.ts` 같이 매핑 주석을 단 줄에 추가.

예:
```markdown
### 첫 진입
- [x] 환영 카피(`welcome.intro`) 1줄 표시  ← tests/e2e/first-entry.spec.ts
- [x] API 키 모달 자동 노출. ESC/배경 클릭 무효  ← tests/e2e/first-entry.spec.ts
...
```

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
npx playwright test
```

- 빌드/린트/유닛 모두 PASS
- `npx playwright test` 결과: 기존 4 + 신규 9 = **총 13 test PASS** (chromium 1 worker 기준)
- `verification-report.md` 의 "첫 진입" + "URL 입력" 섹션 모든 항목 `[x]` 마킹

## 검증 절차

1. AC 커맨드 실행
2. 체크리스트:
   - [ ] `tests/e2e/first-entry.spec.ts` 에 5개 test 작성
   - [ ] `tests/e2e/url-input.spec.ts` 에 4개 test 작성
   - [ ] (필요 시) `tests/e2e/helpers.ts` 에 `enterKeysOnly` 추가
   - [ ] `phases/0-mvp/verification-report.md` 의 9개 항목 `[x]` + 매핑 주석
   - [ ] `npx playwright test` 가 13 PASS
   - [ ] 기존 unit 테스트 375+ 유지 (회귀 없음)
3. 결과에 따라 `phases/1-finish-verification/index.json` 의 해당 step 을 업데이트:
   - 통과 → `"status": "completed"`, `"summary": "first-entry + url-input e2e spec 2종 추가 (총 9 test), verification-report 9개 항목 자동 검증 [x] 마킹"`
   - 3회 시도 실패 → `"status": "error"`, `"error_message": ...`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": ...`

## 금지사항

- `src/` 디렉토리 수정 금지. 이유: 이 step 은 회귀 테스트 추가만. src 변경이 필요하면 phase 분리.
- 실제 외부 API 호출 금지. `helpers.ts` 의 `mockAll` / `mockYouTubeMeta` 사용. 이유: BYOK + 비용 + 속도.
- ESC 동작 검증 시 `needs_keys` 와 `edit` 모달을 혼동 금지. **`needs_keys` 만 ESC 무효** (PRD 사용자 플로우 A). edit 모달의 ESC 동작은 step 3 에서 다룬다.
- "모든 데이터 삭제" 검증 시 4종 prefix (`keys:`, `report:`, `videometa:`, `flag:`) 모두 확인. 이유: `lib/clearAll.ts` 명세상 4종 동시 삭제가 계약.
- 기존 `helpers.ts` 의 export 시그니처 변경 금지. 추가만 허용. 이유: 다른 spec 들이 의존.
- 기존 spec (smoke / hash-restore / mobile-viewport / csp-console) 깨뜨리지 마라.
