# YouTube Comment Analyzer

> 유튜브 URL 하나로 댓글 상위 100개를 수집·분석해서 크리에이터용 피드백 리포트를 보여주는 정적 단일 페이지 앱.

## 배포 URL

🔗 [https://leeyongdoo76.github.io/harness_framework/](https://leeyongdoo76.github.io/harness_framework/)

첫 배포 후 GitHub Pages 활성화가 필요합니다. `phases/1-deploy/launch-checklist.md`를 참고하세요.

## 주요 기능

- 유튜브 영상 URL 입력 → 영상 메타 정보 미리보기 (제목 · 채널 · 썸네일 · 댓글 수)
- 댓글 상위 100개 자동 수집 (YouTube Data API v3, `order=relevance`)
- Claude Haiku 4.5로 댓글 자동 분석 — 요약, 감정 분포, 강점, 개선점, 키워드, 주목할 댓글
- 분석 결과 캐시 (30일) + URL hash로 새로고침·뒤로가기 시 복원
- 완전 클라이언트 사이드 동작 (서버 없음, BYOK 모델)
- 접근성 (WCAG AA), 반응형, 다크 테마, 한국어 UI

## 사용법

1. 위 배포 URL 또는 로컬 개발 서버에 접속합니다.
2. 본인의 API 키 두 개를 입력합니다.
   - **YouTube Data API v3 키** — Google Cloud Console에서 발급
   - **Anthropic API 키** — Anthropic Console에서 발급
3. 분석할 영상 URL을 붙여넣습니다.
4. "분석 시작"을 클릭하면 보통 30초 이내에 결과 화면이 표시됩니다.

자세한 키 발급 절차는 앱 안 모달의 "API 키는 어떻게 받나요?" 토글에서도 확인할 수 있습니다.

## API 키 발급 가이드

### YouTube Data API v3

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 새 프로젝트를 생성합니다.
3. "APIs & Services > Library"에서 **YouTube Data API v3**를 검색해 활성화합니다.
4. "Credentials > Create credentials > API key"를 클릭합니다.
5. 생성된 키를 복사해 앱에 입력합니다.

### Anthropic API

1. [Anthropic Console](https://console.anthropic.com/)에 접속합니다.
2. 계정을 생성하고 결제 수단을 등록합니다.
3. "API Keys > Create Key"를 클릭합니다.
4. 생성된 키를 복사해 앱에 입력합니다.

> Anthropic API는 사용량에 따라 과금됩니다. 본 앱은 Claude Haiku 4.5를 사용하며 댓글 100개 기준 호출당 비용은 매우 작습니다 (input ~10K tokens, output ~2K tokens).

## 프라이버시

- 입력한 API 키는 **이 브라우저의 localStorage에만 저장**되며 외부로 전송되지 않습니다 (YouTube / Anthropic API 호출은 제외).
- 분석 결과 캐시도 동일하게 로컬에만 저장됩니다. 설정 모달의 "모든 데이터 삭제"로 언제든 초기화할 수 있습니다.
- 이 앱은 분석/추적 SDK (Google Analytics, Sentry, PostHog 등)를 일체 사용하지 않습니다.
- React ErrorBoundary가 잡은 예기치 못한 에러도 외부로 전송하지 않습니다.

## 로컬 개발

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production 빌드 (dist/)
npm run preview      # dist/ 미리보기
npm test             # unit (vitest)
npx playwright test  # e2e (Playwright)
npm run lint
```

요구 환경: Node.js 20 LTS · 패키지 매니저는 **npm 고정** (yarn / pnpm 금지)

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드하고 GitHub Pages에 배포합니다.
워크플로우 정의는 `.github/workflows/deploy.yml`을 참고하세요.

빌드 산출물은 `dist/`이며, GitHub Pages 프로젝트 사이트 경로(`/harness_framework/`)에 맞게 Vite `base`가 build 시점에만 분기됩니다 (`vite.config.ts` 참고).

## 라이센스

라이센스는 별도로 명시하지 않았습니다. 이 저장소를 fork 또는 활용하려는 경우 원 저작자 권리를 존중하고 본인이 적절한 라이센스를 선택해 주세요.

## 크레딧

- 프레임워크 뼈대: [jha0313/harness_framework](https://github.com/jha0313/harness_framework)
- 앱 구현: Lee YongDoo
