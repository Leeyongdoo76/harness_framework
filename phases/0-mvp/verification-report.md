# Verification Report — 0-mvp

작성일: 2026-05-13
실행자: claudecode (step 11)

## 자동 (Playwright smoke 4종)

- [x] `npx playwright test tests/e2e/smoke.spec.ts` PASS
- [x] `npx playwright test tests/e2e/hash-restore.spec.ts` PASS
- [x] `npx playwright test tests/e2e/mobile-viewport.spec.ts` PASS
- [x] `npx playwright test tests/e2e/csp-console.spec.ts` PASS

**현재 상태** (2026-05-14, Finding #1 + #3 fix 적용 후): **4/4 PASS**.

- Finding #1 (CSP) RESOLVED.
- Finding #3 (hash-restore 의 cascading 두 원인 — e2e helper + 제품의 hash 부트스트랩 캐시 미조회) RESOLVED.
- step 11 의 "4/4 동일 원인" 진단은 부분적으로 부정확했음. CSP 차단이 가장 먼저 터지면서 그 뒤의 reload 단계까지 도달하지 못해 4건이 같은 stack 으로 죽어 보였던 것.

## 수동 체크리스트

### 첫 진입
- [ ] 환영 카피(`welcome.intro`) 1줄 표시
- [ ] API 키 모달 자동 노출. ESC/배경 클릭 무효
- [ ] 발급 가이드 토글 펼침/접힘 동작
- [ ] 두 키 모두 입력해야 "저장" 활성화
- [ ] "모든 데이터 삭제" → ConfirmDialog → 확정 시 localStorage prefix 4종 모두 삭제

### URL 입력
- [ ] 잘못된 URL 4종 (도메인/videoId/플레이리스트/채널) → 각 인라인 에러
- [ ] blur 또는 Enter 시 메타 호출
- [ ] 같은 videoId 재입력 → 메타 재호출 안 함 (DevTools Network 탭 확인)
- [ ] 메타 1시간 캐시 — `videometa:{videoId}` 키가 localStorage에 존재

### 분석
- [ ] 진행 표시 ("댓글 모으는 중…" → "AI 분석 중…")
- [ ] "취소" 버튼 → idle 복귀
- [ ] 결과 6개 카드 모두 fade-in 진입

### 결과
- [ ] 결과 헤더에 분석 시점 + 표본 크기
- [ ] 면책 카피 하단 노출
- [ ] 댓글 < 10 시 lowConfidence 경고 (테스트용 mock으로)
- [ ] 캐시 히트 시 "{시간} 전 분석 · 캐시된 결과" + 재분석 강조

### 오프라인
- [ ] DevTools Network → Offline 토글 → 상단 배너 노출
- [ ] 분석 중 offline 진입 → 진행 중단 + 에러 표시
- [ ] online 복귀 → 배너 사라짐

### 에러 복구
- [ ] 잘못된 키로 분석 → AI_AUTH/YT_AUTH 에러 → 설정 모달 자동 오픈
- [ ] 키 수정 후 저장 → previous 복귀 (idle 아님)
- [ ] 에러 화면 "다시 시도" → previous 실행

### 접근성
- [ ] Tab만으로 모든 동작 가능
- [ ] focus ring 가시 (모든 인터랙티브 element)
- [ ] 모달 focus trap (Tab/Shift+Tab wrap)
- [ ] needs_keys 모달 ESC 무효, edit 모달 ESC 닫힘
- [ ] OS `prefers-reduced-motion: reduce` 설정 → fade-in 정지
- [ ] sentiment 차트 옆에 라벨 + 퍼센트 (색 없이 의미 파악)
- [ ] 키워드 태그가 색 + 카운트 + sentiment 라벨로 의미 전달

### 페이지 메타
- [ ] 분석 중 title = "분석 중… - YouTube 댓글 분석"
- [ ] 결과 도착 title = "{영상 제목} - 분석 결과"
- [ ] hash가 "분석 시작" 클릭 직후 갱신 (결과 도착 후 아님)

### 프라이버시
- [ ] 키 표시는 마스킹 (마지막 4자만)
- [ ] DevTools Network에 키가 다른 도메인으로 전송 안 됨
- [ ] ErrorBoundary fallback에서 외부 전송 호출 없음 (Network 탭 확인)

### PoC (사전 확인)
- [x] step 5 시작 전 `npm run poc` 1회 성공 (step 0 에서 완료)
- [x] PoC 결과가 step 0 summary 에 기록됨 — ADR-003 갱신 (캐시 폐기)

## 발견 사항

### Finding #1 — Production CSP 가 YouTube API host 차단 (CRITICAL) — RESOLVED (2026-05-14)

**상태**: RESOLVED — `connect-src` 에 `https://www.googleapis.com` 을 추가하는 fix 가 적용됨. Playwright smoke / mobile-viewport / csp-console 3종이 GREEN 으로 전환됨. 후속 발견 사항은 Finding #3 참고.

**증상**: Playwright smoke 4종 모두 동일한 원인으로 FAIL.

**재현**:
```
[browser error] Connecting to 'https://www.googleapis.com/youtube/v3/videos?...'
violates the following Content Security Policy directive:
"connect-src 'self' https://youtube.googleapis.com https://api.anthropic.com".
The action has been blocked.
```

**원인**:
- `src/services/youtube.ts` 의 `VIDEOS_URL` / `COMMENT_THREADS_URL` 은 `https://www.googleapis.com/youtube/v3/...` 을 호출.
- `index.html` 의 CSP `connect-src` 는 `https://youtube.googleapis.com` 만 허용.
- 두 host (`www.googleapis.com` vs `youtube.googleapis.com`) 는 YouTube Data API v3 의 동등한 alias 이지만 CSP 입장에서는 서로 다른 origin.
- 결과적으로 production 빌드에서도 YouTube 메타/댓글 호출이 전부 CSP 에 의해 차단된다 — 앱이 동작하지 않는다.

**영향**:
- 실제 사용자가 어떤 URL 을 입력해도 메타 카드가 `[videoId]` fallback 으로만 떨어지고, "분석 시작" 후엔 NetworkError 가 발생한다 (대부분 사용자는 "오프라인인가?" 로 오인할 가능성 큼).
- 단위/통합 테스트는 happy-dom 이라 CSP 가 미적용 — 그래서 step 1–10 에서 발견되지 못함. ADR-032 (Playwright e2e) 가 정확히 이런 종류의 회귀를 잡는 안전망.

**적용된 수정 (2026-05-14)**:
1) `index.html` 의 `connect-src` 에 `https://www.googleapis.com` 추가 (live CSP):
   ```
   connect-src 'self' https://www.googleapis.com https://youtube.googleapis.com https://api.anthropic.com;
   ```
2) CLAUDE.md, docs/ADR.md (ADR-018), docs/ARCHITECTURE.md, phases/0-mvp/step0.md 의 CSP 예시도 동시 갱신해 단일 SSOT 유지.

**검증**: `npm run build && npm run lint && npm test` 모두 PASS (369 unit tests). Playwright 3종 추가 PASS.

**우선순위**: BLOCKER — 이 fix 없이는 production 에서 앱 자체가 동작 안 함.

### Finding #2 — `dist/index.html` 의 chunk 크기 경고

**증상**: `npm run build` 출력에 chunk > 500KB 경고. gzip 211KB — 비기능 요구 "gzip < 300KB" 는 만족.

**원인**: Recharts + Anthropic SDK 가 단일 번들에 모두 포함.

**영향**: 첫 페이지 로드 약간 느려질 수 있으나 임계값 미초과. MVP 한정으로는 OK.

**권장 수정**: MVP 이후 dynamic import 또는 manualChunks 분리. 후속 phase 후보 (non-blocking).

### Finding #3 — hash-restore 의 cascading 두 원인 (HIGH) — RESOLVED (2026-05-14)

**상태**: RESOLVED. 표면 원인(e2e helper)을 고치고 나니 그 뒤에 가려져 있던 제품의 hash 부트스트랩 캐시 미조회 문제가 드러남. 둘 다 적용하고 Playwright 4/4 GREEN, vitest 372 PASS 확인.

**발견 시점**: 2026-05-14, Finding #1 fix 적용 후 Playwright 재실행 중 단독 FAIL 로 드러남.

**증상**: `tests/e2e/hash-restore.spec.ts` 만 FAIL.
```
Error: expect(locator).toBeVisible() failed
  Locator: getByRole('heading', { name: '요약' })
  Expected: visible (after page.reload())
  Actual: API 키 모달이 다시 노출됨
```
`page.reload()` 직후 화면이 결과가 아니라 첫 진입(API 키 모달) 상태로 떨어진다.

**원인**:
- `tests/e2e/helpers.ts` 의 `clearStorage` 가 `page.addInitScript` 로 등록돼있음.
- `addInitScript` 는 **모든** 페이지 로드(최초 navigation + 모든 reload + 동일 origin 의 후속 navigation) 직전에 실행됨.
- 따라서 `page.reload()` 시점에도 localStorage / sessionStorage 가 다시 비워짐 → 분석 결과 캐시 (`reportcache:{videoId}` 등) 와 API 키 (`apikeys`) 모두 소실.
- hash-restore 테스트는 정의상 reload 후 cache hit 을 검증해야 하므로, 이 helper 와 본질적으로 충돌.

**영향**:
- 제품 코드에는 결함 없음. 테스트 스캐폴딩만의 버그. → step 10 의 App 통합 동작과 hash-restore 의 제품 요구는 변동 없음.
- 다만 hash-restore e2e 가 회귀 안전망 역할을 못 하고 있음. `useUrlHash` 가 깨지면 잡히지 않을 수 있다.
- step 11 의 verification-report 가 4종을 "동일 원인" 으로 묶은 진단 자체가 부분적으로 부정확했다는 의미도 됨 (CSP 가 먼저 터져 reload 단계까지 도달 못 했던 것).

**적용된 수정 (2026-05-14)**:

1) **테스트 인프라**: `tests/e2e/helpers.ts` 의 `clearStorage` 가 `window.name` 센티넬을 사용하도록 변경. 최초 navigation 에서 1회만 storage 를 비우고, 같은 탭의 reload 에서는 보존됨.
   ```ts
   await page.addInitScript(() => {
     if (window.name !== "__cleared__") {
       try { localStorage.clear(); sessionStorage.clear(); } catch {}
       window.name = "__cleared__";
     }
   });
   ```
2) **제품 코드**: `src/lib/reducer.ts::initialState` 에서 `hashVideoId` 가 있고 캐시 hit 이면 곧장 `kind: "result"` 로 부트스트랩하도록 변경. 캐시 miss 인 경우만 `idle` 로 떨어지고 기존 Effect 1 의 `HASH_VIDEO_ID` 경로(메타 로딩 → metaReady)를 탄다. PRD 의 "캐시된 결과 즉시 표시" / "재분석" 동작과 일치.
3) `src/lib/reducer.test.ts` 에 새 부트스트랩 케이스 3종 추가 (no-cache, cache-hit, with-truncatedCount). 기존 369 → **372 PASS**.

**원인 정리** (왜 표면-원인 fix 만으로는 부족했는가):
- 표면: e2e helper 가 reload 후 storage 를 또 비워서 캐시가 사라짐.
- 그 뒤에 가려진 본질: 캐시가 살아있더라도 hash 부트스트랩 경로가 `HASH_VIDEO_ID` → `metaLoading` → `metaReady` 까지만 가고 자동으로 cache 를 조회하지 않았음. 사용자에게 "분석 시작" 재클릭을 강요하는 셈. PRD 의 의도(`캐시 히트 시 캐시된 결과 즉시 표시`)와 불일치.

**검증**: `npm run build && npm run lint && npm test` 모두 PASS. Playwright 4/4 GREEN.

**우선순위**: HIGH — BLOCKER 는 아니었으나 e2e 안전망 1/4 이 작동 안 했고, 사용자 입장에선 PRD 가 약속한 reload 자동 복원이 실제로는 안 됐던 셈.

## 결론

step 11 의 deliverables (4 specs + 3 fixtures + 이 리포트) 는 모두 작성 완료. Playwright 가 실제 production CSP 환경에서 회귀를 잡아낸 첫 사례 — Finding #1 은 ADR-032 의 가치를 즉시 증명한 셈.

**2026-05-14 갱신**: Finding #1 (CSP BLOCKER) 과 Finding #3 (cascading: e2e helper + hash 부트스트랩 캐시 미조회) 모두 RESOLVED. Playwright 4/4 GREEN, vitest 372 PASS, lint/build 통과. step 11 의 "4/4 동일 원인" 진단이 부분적으로 부정확했던 이유는 보고서 본문에 정리.
