# Step 0: build-config-base-path

## 읽어야 할 파일

- `/CLAUDE.md` — 배포 섹션 ("정적 호스팅", "GitHub Pages 사용 시 `vite.config.ts`의 `base`를 `/{repo}/`로 설정")
- `/docs/ARCHITECTURE.md` — 빌드 / 배포 섹션
- `/docs/ADR.md` — 빌드 산출물 관련 ADR
- `/vite.config.ts` — 현재 설정
- `/index.html` — entry HTML
- `/package.json` — `build` 스크립트
- `/phases/1-deploy/launch-checklist.md` (다음 step 의 산출물 — 이 step 에서는 없음)

## 작업

본 프로젝트가 GitHub Pages 의 **project pages** (`https://{user}.github.io/{repo}/` 형태) 로 배포될 예정. Vite 의 `base` 설정이 production 빌드에서 `/harness_framework/` 경로를 prefix 로 붙여야 한다 (asset 절대경로가 올바르게 동작하도록).

### 1. `vite.config.ts` 수정

기존 설정을 유지하되 `defineConfig` 에 함수형 형태를 사용해서 `command` 에 따라 `base` 분기:

```ts
export default defineConfig(({ command }) => ({
  // ... 기존 설정 (plugins, resolve, server 등) 그대로 ...
  base: command === "build" ? "/harness_framework/" : "/",
}));
```

이유:
- `command === "build"` (production 빌드) → `/harness_framework/`
- `command === "serve"` (dev server) → `/` (localhost:5173 에서 그대로 동작)
- 이렇게 분기하면 dev 환경에 영향 없이 prod 빌드에만 base path 가 박힘

> **중요**: 기존 `defineConfig({ ... })` 가 객체 리터럴 형태였다면 함수형으로 바꾸면서 다른 설정 (plugins / resolve.alias 등) 을 잃지 않도록. 변환 후 동일 의미인지 확인.

### 2. 검증 — `dist/` 출력 확인

`npm run build` 실행 후:

```bash
# dist/index.html 의 script / link 가 /harness_framework/ prefix 가 붙어있는지 확인
grep -E '(src|href)="/harness_framework/' dist/index.html
# 매치가 있어야 함 (최소 1줄)

# dev 동작 영향 없음을 확인 (다음 명령은 background 실행 또는 사용자 수동)
# npm run dev → http://localhost:5173/ 에서 정상 로드 (이 step 자동 검증은 X)
```

`dist/index.html` 안의 asset 절대경로가 `/harness_framework/assets/...` 로 시작하면 OK.

### 3. assets 폴더의 경로도 동일하게 prefix 적용되는지 확인

Vite 가 자동으로 처리하지만 명시적으로:

```bash
# dist/ 의 모든 .html 의 모든 절대경로 src/href 가 /harness_framework/ 로 시작
grep -Eo '(src|href)="/[^"]*"' dist/*.html | grep -v '/harness_framework/' && echo "FAIL" || echo "OK"
```

매치가 없으면 OK (모든 절대경로가 /harness_framework/ prefix).

### 4. 기존 dev / test 흐름 영향 없음 보장

- `npm run dev` 는 여전히 `localhost:5173/` (root) 에서 동작
- `npm test` 의 vitest 가 빌드 결과를 참조하지 않으므로 영향 없음
- `npx playwright test` 의 `webServer.command: "npm run dev"` 는 dev 서버를 띄우니까 영향 없음 (base 가 / 인 dev 상태)

위 사항을 빌드 / 린트 / unit / e2e 통과로 확인.

## Acceptance Criteria

```bash
npm run build
test -d dist && grep -q 'src="/harness_framework/' dist/index.html  # base path 확인
npm run lint
npm test
npx playwright test
```

- `dist/index.html` 의 script src 가 `/harness_framework/` 로 시작
- `dist/index.html` 의 link href (CSS 등) 도 `/harness_framework/` 로 시작
- 기존 379+ unit test 회귀 없음
- 기존 37 e2e (dev server 기반) 회귀 없음

## 검증 절차

1. AC 커맨드 실행
2. 체크리스트:
   - [ ] `vite.config.ts` 가 `defineConfig(({ command }) => ({ ..., base: ... }))` 함수형으로 변환됨 (또는 동등한 분기 표현)
   - [ ] 기존 설정 (plugins, resolve.alias 등) 누락 없음
   - [ ] `npm run build` 통과
   - [ ] `dist/index.html` 의 절대경로 asset 들이 `/harness_framework/` prefix
   - [ ] `npm run dev` 가 여전히 `/` 에서 동작 (수동 검증 또는 e2e PASS 로 간접 확인)
   - [ ] `npm test` 통과
   - [ ] `npx playwright test` 통과 (회귀 0건)
3. `phases/1-deploy/index.json` 의 step 0 업데이트:
   - 통과 → `"summary": "vite.config.ts base 분기 ('/harness_framework/' on build, '/' on serve), dist 빌드 결과 검증, 기존 dev/test 흐름 영향 없음"`

## 금지사항

- `vite.config.ts` 의 다른 설정 (plugins, resolve, server 등) 을 임의로 제거하지 마라. **base 분기 추가만** 허용. 이유: 기존 동작 유지.
- `base` 를 dev 와 prod 양쪽 모두 `/harness_framework/` 로 통일하지 마라. dev 에서는 `/` 가 정상 — 통일하면 localhost 흐름이 깨짐. 이유: 개발 편의.
- `package.json` 의 scripts 를 임의로 수정하지 마라. 이유: step 단일 책임.
- 새로운 의존성 추가 금지. 이 step 은 config 1줄 변경만. 이유: 단일 책임.
- `index.html` 의 `<base href="...">` 를 추가하지 마라. Vite 가 빌드 시 자동으로 처리. 이유: 중복 / 충돌 회피.
