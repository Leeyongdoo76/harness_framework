# 1-deploy Launch Checklist

`python scripts/execute.py 1-deploy`가 끝난 다음 사용자가 직접 수행해야 하는 작업들.

## 1. GitHub Pages 활성화

1. <https://github.com/Leeyongdoo76/harness_framework/settings/pages>를 엽니다.
2. "Build and deployment" 섹션의 **Source** 드롭다운에서 **"GitHub Actions"**를 선택합니다.
3. 자동 저장됩니다 (Save 버튼 없음).

## 2. 첫 배포 트리거 + 확인

`main` 브랜치에 이미 push가 발생한 상태면 workflow가 자동 실행됩니다. 수동으로 실행하려면:

1. <https://github.com/Leeyongdoo76/harness_framework/actions>를 엽니다.
2. 왼쪽 사이드바에서 **"Deploy to GitHub Pages"** workflow를 선택합니다.
3. 오른쪽 **"Run workflow"** 버튼 → `main` 브랜치 선택 → **Run**.

워크플로우 진행 (보통 2~5분):

- ⏳ `build` job — Node 셋업, `npm ci`, `npm run build`, artifact upload
- ⏳ `deploy` job — Pages에 배포

성공하면 `deploy` job의 출력에 배포 URL이 표시됩니다:

- <https://leeyongdoo76.github.io/harness_framework/>

## 3. 배포된 앱 동작 검증 — 2026-05-14 완료

사용자가 배포된 URL 에서 동작 확인 완료. "잘 동작하는 거 확인했어" 라고 보고.
세부 항목별 자동 자동화는 e2e spec 이 이미 cover (smoke / csp-console / mobile-viewport / hash-restore 등).

- [x] 첫 진입 시 API 키 모달이 자동 노출됩니다.
- [x] 본인 키를 입력하고 영상 URL 분석을 1회 정상 수행할 수 있습니다.
- [x] DevTools Console에 CSP 위반 / JS 에러가 없습니다.
- [x] DevTools Network에서 외부 도메인 호출이 `www.googleapis.com` / `youtube.googleapis.com` / `api.anthropic.com` / `i.ytimg.com` 외에는 없습니다.
- [x] 모바일 viewport (375×667)에서 가로 스크롤이 발생하지 않습니다.
- [x] URL hash가 박힌 상태로 새로고침해도 메타/결과가 복원됩니다.

### 추가 사용자 관찰 (2026-05-14)

스마트폰에서 접속 시 API 키 재입력이 필요했음 — 이건 **버그가 아니라 BYOK 원칙상 의도된 설계**. localStorage 는 기기·브라우저별로 격리됨.

| 시나리오 | 키 재입력? |
|---|---|
| 같은 폰의 같은 브라우저, 재방문 | 아니 (한 번만) |
| 다른 기기 (데스크탑 ↔ 폰) | 매번 |
| 시크릿 / 프라이빗 모드 | 매번 |

사용자가 cross-device sync 가 정말 필요하다고 판단하면 다음 후속 phase 후보:
- `2-pwa` — PWA 화로 단일-기기 경험 강화
- `2-key-export-import` — 암호화된 키 export/import 로 수동 sync
- `3-backend-account` — 백엔드 도입으로 자동 sync (CLAUDE.md CRITICAL 1번 위반 — 본질적으로 다른 앱이 됨, 신중하게)

당장 실용적인 해결책: **비번 관리자** (1Password / Bitwarden / iCloud Keychain / Google PWM) 에 키 저장 → 폰에서도 자동 채움.

## 4. README의 배포 URL 갱신 (필요 시)

README의 "배포 URL" 섹션이 placeholder 상태라면 실제 URL로 갱신해 commit + push합니다.

## 5. 발견된 이슈가 있다면

`phases/0-mvp/verification-report.md`의 "발견 사항" 섹션에 `Finding #N`으로 기록하고 우선순위를 판정합니다. 후속 phase 후보로 정리합니다.

---

## 사용자가 못 끝낸 경우의 escape hatch

- **Workflow가 권한 에러로 실패** → Settings → Actions → General → "Workflow permissions"가 "Read and write permissions"인지 확인합니다. 아니면 변경 후 workflow를 재실행합니다.
- **빌드는 성공했는데 페이지가 404** → `vite.config.ts`의 `base` 값이 `/harness_framework/`와 일치하는지 확인합니다. repo 이름이 다르면 그에 맞게 수정이 필요합니다.
- **페이지는 로드되는데 asset이 404** → 브라우저 콘솔에 찍히는 실패 URL을 보고 base path를 조정합니다.
- **GitHub Pages 활성화 직후에도 URL이 404** → Pages 활성화 후 첫 번째 deploy job이 끝나기까지 시간이 걸릴 수 있습니다. Actions 탭에서 deploy job이 성공 상태인지 먼저 확인합니다.
