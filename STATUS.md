# Status — YouTube Comment Analyzer

> 작성: 2026-05-14
> 다음에 작업 재개 시 **이 문서부터** 읽으면 어디서 멈췄는지 한 눈에 보입니다.

## 1. 한 줄 요약

0-mvp 구현 + 검증 + 배포까지 끝낸 상태. 공개 URL 살아있음. 다음 작업은 **사용자 결정 대기 중** (실사용자 피드백 수집 vs 즉시 polish/perf/features 후속 phase).

## 2. 완료된 phase

| phase | 상태 | 완료일 | 핵심 산출물 |
|---|---|---|---|
| **0-mvp** | ✅ | 2026-05-13 | Vite + React + TS strict 부트스트랩, 도메인 타입, services (youtube + claude), reducer 상태머신, 16 컴포넌트, 카드 6종, App 통합, Playwright e2e 4종, verification-report |
| **1-finish-verification** | ✅ | 2026-05-14 | Playwright e2e +33 (총 37), unit test +8 (총 380), 자동화 가능한 수동 체크리스트 27/27 [x] + 사람-전용 잔여 5/5 [x] (사용자 manual pass 완료) |
| **1-deploy** | ✅ | 2026-05-14 | `vite.config.ts` base 분기, `.github/workflows/deploy.yml`, README, `index.html` meta, GitHub Pages 활성화 + 첫 배포 + 사용자 동작 확인 완료 |

## 3. 배포된 앱

🔗 https://leeyongdoo76.github.io/harness_framework/

- 사용자 검증: 2026-05-14 "잘 동작하는 거 확인했어"
- 자동 검증 (e2e + unit) 모두 GREEN, lint clean, build clean

## 4. 현재 git 상태

- **브랜치**: `main` (1813f01 이후 추가 commit 들 — 자세히는 `git log --oneline` 으로 확인)
- **Remote**: https://github.com/Leeyongdoo76/harness_framework (본인 fork, jha0313 에서 fork 한 것)
- **로컬 브랜치**: main, feat-0-mvp, feat-1-finish-verification, feat-1-deploy (마지막 셋은 main 으로 머지된 상태 — 삭제해도 됨)
- **Origin 브랜치**: main, feat-0-mvp, feat-1-finish-verification (feat-1-deploy 는 main 머지 후 push 안 했지만 main 에 다 들어가있음)

## 5. 발견된 이슈 (해결 안 됨, 후속 phase 후보)

| ID | 우선순위 | 내용 | 추천 후속 phase |
|---|---|---|---|
| **Finding #2** | non-blocking | bundle chunk 745KB (gzip 211KB — 한도 300KB 는 만족). Recharts + Anthropic SDK 가 단일 번들 | `1-perf` |
| **관찰 1** (2026-05-14) | low | 폰에서 키 재입력 필요 — BYOK 원칙상 의도된 설계지만 UX 불편 가능 | `2-pwa` 또는 `2-key-export-import` 또는 비번 관리자로 해결 |
| **Finding #4 잔여** | low | `metaLoading` 에서 retry 시 stale controller 위험. 메타 서버 5xx 가 드물어서 사용자 임팩트 낮음 | 작은 후속 phase 1~2 step |

## 6. 다음 작업 — 옵션들

### 추천 순서

```
지금 ─── (관찰 1~수 주) ─── 1-polish 또는 1-perf 또는 2-features
        실사용자 피드백 수집           (모인 신호 기준 우선순위 결정)
```

### 후속 phase 후보 (우선순위 순)

| phase | 목적 | 트리거 조건 |
|---|---|---|
| **실사용자 피드백** (phase 아님, 관찰 단계) | 친구/지인 2~5명에게 URL 공유 + 본인 채널 영상으로 5~10개 분석 → 어디가 거슬리는지 메모 | 지금 바로 시작. 결과 신호 모이는 데 며칠~몇 주 |
| **1-perf** | Finding #2 fix — dynamic import + manualChunks 로 chunk 분리, 첫 페인트 최적화 | 사용자가 "느리다" 신호 줬거나, 본인이 답답하다고 느낀 시점 |
| **1-polish** | 본인/사용자가 발견한 UX 디테일 정리 | polish 거리가 명확히 모인 시점 |
| **2-pwa** | PWA 화 → 단일 기기 경험 강화 (홈 화면 설치, persistent storage 우선순위 강화) | cross-device 가 안 되는 한계는 그대로지만 같은 기기 경험은 매끄러워짐 |
| **2-key-export-import** | 암호화된 키 export/import 로 사용자가 수동으로 cross-device sync | BYOK 유지하면서 sync 원하면 |
| **2-features-***  | 영상 비교 / CSV export / i18n / 채널 분석 등 (PRD v2 필요) | 본인이 정말 만들고 싶은 신기능이 명확한 시점 |
| **3-backend-account** | 백엔드 도입 (Supabase 등) — 사용자 계정 + 자동 sync | **CLAUDE.md CRITICAL 1번 위반** — 신중. 본질적으로 다른 앱이 됨, 신규 프로젝트로 시작 권장 |

## 7. 어떻게 이어서 작업하나

### 다음 세션에서

1. 터미널 열고 `cd C:\Project\claudecode\harness_framework`
2. `git status` 로 깨끗한지 확인 — clean 이면 OK
3. `git log --oneline -10` 으로 최근 변경 확인
4. **이 `STATUS.md` 읽기** (사용자 자신용)
5. Claude Code 켜고 자연어로 작업 지시:
   - 예: "`STATUS.md` 보고 다음 단계 진행하자"
   - 예: "1-perf phase 시작해줘" (방향 결정됐으면 바로)
   - 예: "사용자 피드백 받았는데 X 가 거슬린다네. 후속 phase 로 잡자"
6. Claude 가 `CLAUDE.md` + `STATUS.md` + 메모리 시스템으로 자동으로 컨텍스트 받음

### 새 phase 시작하려면

자연어로: "X phase 시작해줘"
또는 슬래시 커맨드: `/harness`
→ Claude 가 docs 다시 훑고 step 설계 → 동의 받고 `phases/X/step*.md` 생성 → `python scripts/execute.py X` 안내

### 만약 다른 기기/환경에서 이어서 하려면

1. https://github.com/Leeyongdoo76/harness_framework 에서 `git clone`
2. `npm install`
3. `STATUS.md` 읽기
4. 위와 동일

## 8. 메모해두면 좋은 것

- **본 프로젝트의 모든 규칙은 `CLAUDE.md` SSOT** — Claude 가 자동 로드함
- **모든 phase 의 step 파일은 `phases/{phase}/step*.md`** — execute.py 입력
- **수동 검증 결과는 `phases/0-mvp/verification-report.md`** + 각 phase 의 `*-checklist.md`
- **API 키는 사용자 본인 것** — repo 어디에도 키 저장 금지 (BYOK + ADR-002)
- **commit 메시지**: Conventional Commits — `feat(phase): step N — name` / `chore(phase): ...` / `fix(phase): ...`
- **머지 전략**: 각 phase 끝나면 `feat-{phase}` → `main` fast-forward 머지 + push (이번 0-mvp / 1-finish-verification / 1-deploy 셋 다 이 방식)

---

## 부록 — 이번 세션 (2026-05-14) 에서 한 일

1. Windows 업데이트 후 재개 — CSP fix (Finding #1) 마무리
2. Finding #3 발견 + fix — e2e helper + hash 부트스트랩 캐시 복원
3. Finding #4 발견 + fix — RESET_ERROR 좀비 상태
4. Finding #5 발견 + fix — Claude 가 markdown 펜스로 JSON 감싸는 문제
5. **1-finish-verification phase 설계 + 실행** — 회귀 그물 +33 e2e
6. 사람-전용 manual pass 5개 — 완료
7. 본인 GitHub 으로 fork + remote 갱신 + push
8. **1-deploy phase 설계 + 실행** — GitHub Pages 자동 배포
9. 실제 배포 + 사용자 동작 확인
10. 폰 vs 데스크탑 키 sync 질문 → BYOK 설계상 의도된 동작임을 정리

총 commit 수: 약 50+ (3 phases + 4 finding fixes + branch 머지 + 정리)
