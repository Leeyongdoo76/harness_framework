# Verification Report — 0-mvp

작성일: 2026-05-13
실행자: claudecode (step 11)

## 자동 (Playwright smoke 4종)

- [ ] `npx playwright test tests/e2e/smoke.spec.ts` PASS
- [ ] `npx playwright test tests/e2e/hash-restore.spec.ts` PASS
- [ ] `npx playwright test tests/e2e/mobile-viewport.spec.ts` PASS
- [ ] `npx playwright test tests/e2e/csp-console.spec.ts` PASS

**현재 상태**: 4/4 FAIL (모두 동일한 단일 원인). 아래 "발견 사항 #1" 참고.

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

### Finding #1 — Production CSP 가 YouTube API host 차단 (CRITICAL)

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

**권장 수정 (후속 phase 에서 처리)**:
1) `index.html` 의 `connect-src` 에 `https://www.googleapis.com` 추가:
   ```
   connect-src 'self' https://www.googleapis.com https://youtube.googleapis.com https://api.anthropic.com;
   ```
   (또는 둘 중 하나만 — `www.googleapis.com` 단독)
2) ADR-018, ARCHITECTURE 의 CSP 예시도 동시 갱신.

**우선순위**: BLOCKER — 이 fix 없이는 production 에서 앱 자체가 동작 안 함.

**할당**: 후속 phase (예: `phases/0-mvp-fix-csp` 또는 `phases/1-...`).

### Finding #2 — `dist/index.html` 의 chunk 크기 경고

**증상**: `npm run build` 출력에 chunk > 500KB 경고. gzip 211KB — 비기능 요구 "gzip < 300KB" 는 만족.

**원인**: Recharts + Anthropic SDK 가 단일 번들에 모두 포함.

**영향**: 첫 페이지 로드 약간 느려질 수 있으나 임계값 미초과. MVP 한정으로는 OK.

**권장 수정**: MVP 이후 dynamic import 또는 manualChunks 분리. 후속 phase 후보 (non-blocking).

## 결론

step 11 의 deliverables (4 specs + 3 fixtures + 이 리포트) 는 모두 작성 완료. Playwright 가 실제 production CSP 환경에서 회귀를 잡아낸 첫 사례 — Finding #1 은 ADR-032 의 가치를 즉시 증명한 셈. Finding #1 은 BLOCKER 이므로 후속 phase 에서 우선 처리되어야 한다.
