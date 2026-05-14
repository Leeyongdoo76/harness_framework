# Step 1: github-actions-workflow

## 읽어야 할 파일

- `/CLAUDE.md` — 배포 섹션
- `/docs/ARCHITECTURE.md` — 빌드 / 배포
- `/package.json` — npm scripts (`build`, `test`, `lint`)
- `/vite.config.ts` — step 0 산출물 (base path 분기 적용된 상태)
- `/phases/1-deploy/step0.md` — 이전 step 산출물 명세

step 0 산출물:
- `vite.config.ts` (base: `/harness_framework/` on build)
- `dist/` 가 base path 가 적용된 상태로 빌드됨

## 작업

GitHub Pages 로 자동 배포되는 GitHub Actions workflow 작성. main 브랜치에 push 될 때마다 빌드 + 배포가 자동으로 실행되도록.

### 1. `.github/workflows/deploy.yml` 작성

표준 GitHub Pages with Actions 패턴을 따른다. 주요 요소:

- **트리거**: main push + 수동 trigger (`workflow_dispatch`)
- **동시성 제어**: 동일 브랜치 push 가 연속해서 들어오면 이전 workflow 취소 (cancel-in-progress)
- **권한**:
  - `contents: read` — repo 읽기
  - `pages: write` — Pages 배포
  - `id-token: write` — OIDC 토큰 (deploy-pages 가 요구)
- **두 개의 job**:
  1. `build` — Node 셋업, `npm ci`, `npm run build`, dist 를 artifact 로 upload
  2. `deploy` — build job 의 artifact 를 Pages 에 배포

### Workflow 구조 (시그니처 수준)

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: "pages"
  cancel-in-progress: true

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 2. (선택) `.github/workflows/ci.yml` 도 같이 만들까?

이 step 의 범위는 **deploy.yml 만**. CI (lint / test on PR) 는 별도 phase 또는 후속 작업. 이번 step 에서는 추가하지 마라.

> 이유: 단일 책임. CI workflow 가 필요해지면 별도 step 으로 분리.

### 3. 검증

자동 검증 가능한 것:
- 파일 경로: `.github/workflows/deploy.yml` 존재
- YAML 구문 유효성: `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"` 가 에러 없이 통과 (yaml 모듈은 표준 라이브러리 아니지만 pip 로 흔히 있음 — 없으면 `node -e "require('js-yaml').load(...)"` 같은 fallback 도 가능, 또는 단순 grep 으로 핵심 키 존재 확인)
- 필수 키 존재: `permissions.pages`, `permissions.id-token`, `actions/deploy-pages` 액션 reference 등

자동화 어려운 것 (manual / 후속 단계):
- 실제 workflow 가 GitHub 에서 success 하는지 — 이건 사용자가 GitHub Pages 활성화 + main push 후 확인
- workflow 결과로 노출되는 URL 확인

본 step 의 AC 는 **파일 작성 + 구조 검증** 까지. 실제 배포 성공 여부는 step 2 의 launch-checklist 가 다룸.

### 4. 빌드 / 린트 / 테스트 회귀 없음 확인

`.github/workflows/deploy.yml` 추가가 다른 빌드/테스트에 영향을 줄 일은 없지만 명시적 확인:

```bash
npm run build && npm run lint && npm test
npx playwright test
```

## Acceptance Criteria

```bash
test -f .github/workflows/deploy.yml                                       # 파일 존재
grep -q "permissions:" .github/workflows/deploy.yml                         # 권한 섹션
grep -q "pages: write" .github/workflows/deploy.yml                          # Pages 권한
grep -q "id-token: write" .github/workflows/deploy.yml                       # OIDC 권한
grep -q "actions/deploy-pages" .github/workflows/deploy.yml                  # 배포 액션
grep -q "actions/upload-pages-artifact" .github/workflows/deploy.yml         # 아티팩트 업로드
grep -q "branches: \[main\]\|branches:\s*\[main\]\|- main" .github/workflows/deploy.yml    # main 트리거
npm run build && npm run lint && npm test
npx playwright test
```

## 검증 절차

1. AC 커맨드 실행
2. 체크리스트:
   - [ ] `.github/workflows/deploy.yml` 생성됨
   - [ ] `permissions: pages: write` + `id-token: write` 포함
   - [ ] `actions/checkout@v4`, `actions/setup-node@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4` 액션 사용
   - [ ] build job 이 `npm ci && npm run build` 실행하고 `./dist` 를 artifact 로 upload
   - [ ] deploy job 이 build 에 dependent 하고 `deploy-pages` 액션 사용
   - [ ] main push 트리거 + workflow_dispatch (수동 trigger) 모두 포함
   - [ ] concurrency 그룹 `"pages"` + cancel-in-progress
   - [ ] 기존 build/lint/test/playwright 회귀 0건
3. `phases/1-deploy/index.json` 의 step 1 업데이트:
   - 통과 → `"summary": ".github/workflows/deploy.yml 작성 — main push 시 빌드 + GitHub Pages 자동 배포. 표준 actions/deploy-pages 패턴, OIDC 권한, concurrency 그룹."`

## 금지사항

- `actions/*` 의 major 버전을 임의로 낮추지 마라. 위 명시된 버전 (`@v4`, `@v5`) 가 GitHub Pages 의 현재 권장값. 이유: 보안 + 호환성.
- workflow 에 secret 사용 금지 (`secrets.GITHUB_TOKEN` 같은 명시적 토큰 참조도 불필요 — OIDC 가 처리). 이유: BYOK 원칙 + 단순함.
- `npm install` 대신 **반드시 `npm ci`** 사용. 이유: lock 파일 기반 재현 가능한 빌드 (CLAUDE.md 의 npm 고정 규칙).
- workflow 안에서 `playwright` 또는 `vitest` 실행 추가 금지 — 이번 phase 의 단일 책임은 배포. CI (테스트) 는 별도 phase. 이유: 단일 책임.
- 다른 phase / branch 에서의 자동 트리거 금지 — main 만. 이유: PR 단계에서 배포되면 안 됨.
- `.github/workflows/deploy.yml` 외 다른 파일 추가 금지 (예: `.github/dependabot.yml`, `.github/CODEOWNERS` 등). 이유: 단일 책임.
- workflow 의 build job 에서 환경변수로 API 키 같은 secret 주입 금지. 이 앱은 BYOK 라 build 단계에 외부 키 필요 없음. 이유: ADR-002.
