# Step 2: docs-and-launch-checklist

## 읽어야 할 파일

- `/CLAUDE.md` — 페이지 메타 규칙, 카피 SSOT 원칙
- `/docs/PRD.md` — 카피 표 전체 (특히 `meta.description`, `welcome.intro`, 키 발급 가이드 카피 `keys.youtubeGuide` / `keys.anthropicGuide`)
- `/docs/ARCHITECTURE.md` — 배포 / 보안 섹션
- `/index.html` — 현재 head 의 meta 태그 구조
- `/README.md` — 현재 상태 (있다면)
- `/phases/1-deploy/step0.md`, `/phases/1-deploy/step1.md` — 이전 step 산출물 참고
- `/.github/workflows/deploy.yml` (step 1 산출물)

이전 step 산출물:
- `vite.config.ts` (base path 분기)
- `.github/workflows/deploy.yml` (자동 배포 workflow)

## 작업

배포 직전의 문서 작업 3가지: README 갱신 + index.html 메타 보강 + 사용자용 launch checklist 작성.

### 1. `README.md` 갱신

현재 README (있다면) 를 본 프로젝트의 사용자 / 기여자 / 배포 시점의 본인에게 충분한 정보를 담은 내용으로 새로 작성.

#### 필수 섹션 (이 순서대로)

```markdown
# YouTube Comment Analyzer

> 유튜브 URL 하나로 댓글 상위 100개를 수집·분석해서 크리에이터용 피드백 리포트를 보여주는 정적 단일 페이지 앱.

## 배포 URL

🔗 [https://leeyongdoo76.github.io/harness_framework/](https://leeyongdoo76.github.io/harness_framework/)
(첫 배포 후 GitHub Pages 활성화 필요 — `phases/1-deploy/launch-checklist.md` 참고)

## 주요 기능

- 유튜브 영상 URL 입력 → 메타 정보 미리보기
- 댓글 상위 100개 자동 수집 (YouTube Data API)
- Claude Haiku 4.5 로 댓글 자동 분석 — 감정 분포, 강점, 개선점, 키워드, 주목할 댓글
- 결과 캐시 (30일) + URL hash 로 새로고침 복원
- 완전 클라이언트 사이드 (서버 없음, BYOK 모델)

## 사용법

1. 위 배포 URL 또는 로컬 개발 서버로 접속
2. 본인의 API 키 두 개 입력:
   - **YouTube Data API v3 키** — Google Cloud Console 에서 발급
   - **Anthropic API 키** — Anthropic Console 에서 발급
3. 분석할 영상 URL 붙여넣기
4. "분석 시작" 클릭 → 결과 화면 (보통 30초 이내)

자세한 키 발급 가이드는 앱 안 모달의 "API 키는 어떻게 받나요?" 토글 참고.

## API 키 발급 가이드 (요약)

### YouTube Data API v3

(PRD 의 `keys.youtubeGuide` 카피 본문을 정리해서 마크다운 단계별 리스트로)

### Anthropic API

(PRD 의 `keys.anthropicGuide` 카피 본문을 정리해서 마크다운 단계별 리스트로)

## 프라이버시

- 입력한 API 키는 **이 브라우저의 localStorage 에만 저장**되고 외부로 전송되지 않습니다 (YouTube / Anthropic API 호출 외).
- 분석 결과도 동일하게 로컬에만 저장. "설정 > 모든 데이터 삭제" 로 언제든 초기화 가능.
- 이 앱은 분석/추적 SDK (Google Analytics 등) 를 사용하지 않습니다.

## 로컬 개발

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production 빌드 (dist/)
npm test          # unit (vitest)
npx playwright test  # e2e (Playwright)
npm run lint
```

요구: Node.js 20 LTS, npm 고정 (yarn/pnpm 금지)

## 배포

main 브랜치에 push 하면 GitHub Actions 가 자동으로 빌드 + GitHub Pages 배포.
`.github/workflows/deploy.yml` 참고.

## 라이센스

(라이센스 명시 — 사용자가 결정. 일단 placeholder 또는 MIT 추천. 강사 originally jha0313 에서 fork 한 거라면 그쪽 라이센스 따름)

## 크레딧

- 프레임워크 뼈대: [jha0313/harness_framework](https://github.com/jha0313/harness_framework)
- 앱 구현: Lee YongDoo
```

> README 의 톤은 한국어 단정형. 정보 밀도 높게. PRD 의 카피 표를 참고해서 일관된 표현 유지. **이모지 금지 규칙은 UI 본문 한정** — README 같은 외부 문서엔 절제된 이모지 1~2개 허용 (이 템플릿의 🔗 처럼).

### 2. `index.html` 의 meta 태그 보강

현재 `<head>` 에 CSP / charset / viewport / favicon 까지는 있을 것. 다음을 추가 (이미 있으면 갱신):

```html
<meta name="description" content="유튜브 URL 하나로 댓글 상위 100개를 수집·분석해서 크리에이터용 피드백 리포트를 보여주는 정적 단일 페이지 앱." />
<meta name="theme-color" content="#0a0a0a" />
```

PRD 카피 표에 `meta.description` 키가 있으면 그 텍스트를 사용 (없으면 위 placeholder 그대로 OK 또는 `welcome.intro` 활용).

**Open Graph / Twitter Card 태그는 추가하지 않는다** — PRD 명시: "외부 OG 태그: MVP 제외". 이 step 의 범위는 description / theme-color 까지.

### 3. `phases/1-deploy/launch-checklist.md` 작성

execute.py 가 끝난 후 사용자가 GitHub UI 에서 수행할 작업의 가이드.

```markdown
# 1-deploy Launch Checklist

`python scripts/execute.py 1-deploy` 가 끝난 다음 사용자가 직접 수행해야 하는 작업들.

## 1. GitHub Pages 활성화

1. https://github.com/Leeyongdoo76/harness_framework/settings/pages 열기
2. "Build and deployment" 섹션의 **Source** 드롭다운에서 **"GitHub Actions"** 선택
3. (자동 저장됨 — Save 버튼 없음)

## 2. 첫 배포 트리거 + 확인

main 브랜치 push 가 이미 발생한 상태면 workflow 가 자동 실행됨. 수동 실행하려면:

1. https://github.com/Leeyongdoo76/harness_framework/actions 열기
2. 왼쪽 사이드바에서 "Deploy to GitHub Pages" workflow 선택
3. 오른쪽 "Run workflow" 버튼 → main 브랜치 선택 → Run

워크플로우 진행 (~2~5분):
- ⏳ build job — Node 셋업, npm ci, npm run build, artifact upload
- ⏳ deploy job — Pages 에 배포

성공하면 deploy job 의 출력에 배포 URL 표시:
- `https://leeyongdoo76.github.io/harness_framework/`

## 3. 배포된 앱 동작 검증

위 URL 을 브라우저에서 열기. 다음 확인:

- [ ] 첫 진입 시 API 키 모달 자동 노출
- [ ] 본인 키 입력 + 분석 1회 정상 동작
- [ ] DevTools Console 에 CSP 위반 / JS 에러 없음
- [ ] DevTools Network 에서 외부 도메인 호출이 `www.googleapis.com` / `youtube.googleapis.com` / `api.anthropic.com` / `i.ytimg.com` 외에는 없음

## 4. README 의 배포 URL 갱신 (필요 시)

README 의 "배포 URL" 섹션이 placeholder 인 상태라면 실제 URL 로 갱신해서 commit + push.

## 5. 발견된 이슈가 있다면

`phases/0-mvp/verification-report.md` 의 "발견 사항" 섹션에 Finding #N 으로 기록 + 우선순위 판정. 후속 phase 후보로 정리.

---

## 사용자가 못 끝낸 경우의 escape hatch

- workflow 가 권한 에러로 실패 → Settings → Actions → General → "Workflow permissions" 가 "Read and write permissions" 인지 확인. 아니면 변경 + 재실행.
- 빌드는 성공했는데 페이지가 404 → vite.config.ts 의 base 가 `/harness_framework/` 와 일치하는지 확인. repo 이름이 다르면 그에 맞게 수정 필요.
- 페이지는 로드되는데 asset 이 404 → 브라우저 콘솔의 실패 URL 보고 base path 조정.
```

### 4. 검증

자동화 가능한 검증:
- `README.md` 의 필수 섹션 존재 (`grep -E "^## "` 로 헤더 추출, 위 템플릿의 섹션과 비교)
- `index.html` 에 `<meta name="description">` 존재
- `phases/1-deploy/launch-checklist.md` 존재 + GitHub Pages 활성화 안내 포함
- 빌드 / 린트 / 유닛 / e2e 회귀 0건

## Acceptance Criteria

```bash
test -f README.md && grep -q "^## 사용법" README.md && grep -q "^## API 키 발급 가이드" README.md
grep -q '<meta name="description"' index.html
test -f phases/1-deploy/launch-checklist.md && grep -q "GitHub Pages 활성화" phases/1-deploy/launch-checklist.md
npm run build && npm run lint && npm test
npx playwright test
```

## 검증 절차

1. AC 커맨드 실행
2. 체크리스트:
   - [ ] `README.md` 가 위 템플릿의 모든 필수 섹션 포함 (제목 / 배포 URL / 주요 기능 / 사용법 / API 키 발급 / 프라이버시 / 로컬 개발 / 배포 / 크레딧)
   - [ ] `README.md` 의 API 키 발급 가이드가 PRD `keys.youtubeGuide` / `keys.anthropicGuide` 카피와 정합
   - [ ] `index.html` 에 `<meta name="description">` 추가됨 (또는 갱신)
   - [ ] `phases/1-deploy/launch-checklist.md` 작성됨 (Pages 활성화 안내 + 첫 배포 확인 절차 + 검증 체크리스트 + escape hatch)
   - [ ] 빌드 / 린트 / 유닛 / e2e 회귀 0건
3. `phases/1-deploy/index.json` 의 step 2 업데이트:
   - 통과 → `"summary": "README 갱신 (배포 URL, 사용법, 키 발급 가이드, 프라이버시), index.html meta description, launch-checklist.md 작성 — phase 종료 후 사용자가 수행할 Pages 활성화 + 첫 배포 확인 단계 안내"`

## 금지사항

- `package.json` 의 fields 수정 금지. 이유: 단일 책임.
- `LICENSE` 파일을 임의로 생성 / 변경 금지. 사용자가 라이선스를 선택해야 함. README 의 라이센스 섹션도 placeholder 또는 사용자 결정 권장 표현으로 둘 것. 이유: 법적 책임.
- README 에 본인 (Claude) 의 기여를 과장하지 마라. "Co-Authored-By" 같은 표현은 commit 메시지에만 — README 의 크레딧 섹션은 사용자 / 강사 jha0313 기준. 이유: 정확성.
- Open Graph / Twitter Card 태그 추가 금지 — PRD 가 "외부 OG 태그: MVP 제외" 명시. 이유: PRD SSOT 준수.
- `<meta name="description">` 의 텍스트를 PRD 카피 표 외 임의 문구로 만들지 마라. 이유: 카피 SSOT.
- launch-checklist 의 GitHub URL 을 `Leeyongdoo76` 이외의 사용자로 하드코딩 금지. (이미 본인 fork 임을 확인했음.) 이유: 정확성.
- launch-checklist 안에서 사용자에게 destructive action (예: `git reset --hard`) 을 권하지 마라. escape hatch 는 보수적 조치만. 이유: 안전.
