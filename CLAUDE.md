# 프로젝트: YouTube Comment Analyzer

## 한 줄 요약
유튜브 URL 하나로 댓글 상위 100개를 수집·분석해서 크리에이터용 피드백 리포트를 보여주는 정적 단일 페이지 앱.

## 워크플로우 (Harness 프레임워크)
- 이 프로젝트의 작업 절차는 **Harness 프레임워크**를 따른다. 슬래시 커맨드 `/harness` 또는 `.claude/commands/harness.md` 참조.
- 흐름: A. 문서 탐색 → B. 논의 → C. step 설계 → D. `phases/{task}/step{N}.md` 생성 → E. `python scripts/execute.py {task}` 실행.
- **부트스트랩 상태**: 현재 `package.json`/`src/`/`node_modules/` 모두 없다. 첫 phase 의 step 0(`project-setup`) 에서 Vite 템플릿으로 부트스트랩한 뒤 후속 step 으로 진행한다. CLAUDE.md 의 `npm run *` 명령들은 이 부트스트랩 이후에야 유효하다.
- 변경 리뷰는 `/review` 또는 `.claude/commands/review.md` 참조.

## 기술 스택

### 런타임 / 빌드
- Vite 5.x + React 18.x + TypeScript 5.x
- TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`
- Node.js 20 LTS (개발 환경)
- 패키지 매니저: **npm 고정** (yarn/pnpm 금지 — lock 파일 단일화)

### 라이브러리
- Tailwind CSS 3.x — 모든 스타일링
- Recharts 2.x — 차트 (도넛/바)
- @anthropic-ai/sdk (latest) — Claude API
- zod 3.x — 런타임 스키마 검증

### 개발 도구
- Vitest + @testing-library/react + @testing-library/user-event + happy-dom — 단위/컴포넌트 테스트
- ESLint (typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, eslint-plugin-jsx-a11y) — `--max-warnings 0`
- Prettier — 포맷팅

### 금지 의존성
- moment.js, dayjs, lodash (전체 import) — bundle size. Intl/네이티브로 대체.
- react-router, Zustand, Redux, Recoil, jotai — 단일 페이지에 과함.
- styled-components, emotion — Tailwind와 중복.
- axios — fetch로 충분.
- jQuery — 어떤 형태로든 금지.
- 폰트 패키지 (next/font 등) — 시스템 폰트 스택 사용.
- 분석/추적 SDK (Google Analytics, Sentry, PostHog 등) — BYOK 환경의 사용자 신뢰 훼손.

## 아키텍처 규칙

### CRITICAL — 절대 위반 불가

1. **서버 없음**: 백엔드/API 라우트/serverless function 일체 추가 금지. 모든 로직은 클라이언트(브라우저)에서 실행.
2. **API 키는 localStorage에만**: 코드/번들/환경변수/.env/CI secret 어디에도 포함 금지. 사용자가 런타임에 입력한다.
3. **외부 API 호출은 `src/services/`에서만**: 컴포넌트/hook/lib 모듈이 fetch나 Anthropic SDK를 직접 호출 금지.
4. **Claude 응답은 zod 검증 후 사용**: 검증 실패 시 UI를 깨뜨리지 말고 에러 상태 전환, 1회 재시도, 그래도 실패면 사용자 에러.
5. **모든 외부 에러를 도메인 에러로 변환**: services 계층에서 raw Error/HTTP error를 `types/errors.ts`의 도메인 에러로 변환해 throw. 컴포넌트는 raw 에러를 받지 않는다.
6. **상태 라이브러리 도입 금지**: React `useState`/`useReducer`만 사용. context는 prop drilling 3단계 초과 시에만 허용.
7. **React ErrorBoundary 필수**: App 최상위에 ErrorBoundary로 비예측 JS 에러를 잡아 사용자 액션 가능한 화면(새로고침/이슈 보고)을 보여준다. catch한 에러는 외부로 전송하지 않는다 (BYOK 프라이버시).
8. **TDD**: 실패하는 테스트 먼저 → 통과 구현. AC에 `npm test` 통과 포함.

### 사용자 경험 CRITICAL

1. **모든 에러 메시지는 "사용자가 다음에 뭘 해야 하는지" 명시**한다. "오류가 발생했습니다" 단독 사용 금지.
2. **마이크로 카피는 PRD.md의 카피 표를 단일 진실 출처(SSOT)로 한다**. 컴포넌트 안에서 임의로 문구를 만들지 않는다. 새 문구가 필요하면 PRD에 먼저 추가하고 `lib/copy.ts`에서 가져다 쓴다.
3. **모든 분석 결과 화면은 분석 시점과 댓글 표본 크기를 표시한다** (예: "방금 분석 · 댓글 87개 기준").
4. **AI 분석 신뢰도 면책 문구를 결과 화면 하단에 항상 노출**한다 (PRD 카피 표의 `result.disclaimer`).
5. **사용자의 입력/결과를 임의로 잃어버리지 않는다**. 페이지 새로고침/뒤로가기에서도 마지막 URL과 결과는 URL hash + localStorage로 복원된다.
6. **분석 중에는 명시적 "취소" 버튼을 노출**한다. 사용자를 진행 화면에 가두지 마라.
7. **네트워크 끊김 자동 감지**: `navigator.onLine` + online/offline 이벤트로 오프라인 진입 시 상단 배너 + 진행 중 분석 abort.

### 접근성 CRITICAL (WCAG AA)

- **focus management**:
  - 모달 열림 → 첫 input에 focus, focus trap 유지
  - 모달 닫힘 → 트리거 element로 focus 복귀
  - 분석 결과 도착 → 결과 영역에 focus 이동
- **aria-live**:
  - 진행 단계 변화는 `aria-live="polite"`
  - 에러 발생은 `aria-live="assertive"` (`role="alert"`)
- **prefers-reduced-motion**: fade-in 등 모든 transition을 미디어 쿼리로 비활성화
- **터치 영역**: 최소 44×44 px
- **focus ring**: 가시적 (`focus-visible:ring-2 ring-white/40 ring-offset-2 ring-offset-[#0a0a0a]`)
- **색상 외 표현**: 차트/태그의 sentiment는 색 + 라벨(`긍정`/`부정`/`중립`) 동시 표시 (색맹 대응). 차트는 `aria-label` + 시각적으로 숨긴 텍스트 대안 (`<ul>`)
- **이미지/아이콘**: `alt`/`aria-label` 필수. 장식 아이콘은 `aria-hidden="true"`
- **시맨틱 태그**: 카드 제목 `<h2>~<h3>`, 본문 `<p>`, 인용 `<blockquote>`

### 마이크로 카피 톤 규칙

- 한국어 단정형 ("저장합니다" / "다시 시도해주세요")
- "오류" 단독 금지 — 구체적 원인 + 행동 명시 ("YouTube API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요")
- 한 줄 우선. 두 줄 넘어가면 분기 점검.
- 이모지 금지 (UI 본문). 시맨틱이 명확한 곳(예: ✓ 저장됨)은 허용.
- 사과형 ("죄송합니다") 남발 금지. 정보형 우선.
- "Please" / "Sorry" 직역 금지.

### 페이지 메타 규칙

- 페이지 title 동적 변경 (`lib/pageTitle.ts`):
  - 기본: `"YouTube 댓글 분석"`
  - 분석 중: `"분석 중… - YouTube 댓글 분석"`
  - 결과: `"[영상 제목] - 분석 결과"` (영상 제목 없으면 videoId fallback)
- viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover`
- favicon: `/public/favicon.svg`
- meta description: PRD 카피 표 `meta.description`
- 외부 OG 태그: MVP 제외

### 디렉토리 규칙

- `src/components/` — UI 컴포넌트 (.tsx, PascalCase 파일명·디폴트 export)
- `src/components/cards/` — 대시보드 카드. 이름은 `*Card.tsx` 또는 `*Chart.tsx`
- `src/types/` — TypeScript 타입 + zod 스키마 + 도메인 에러 클래스
- `src/lib/` — 순수 유틸 + 오케스트레이터 + hook
- `src/services/` — 외부 API 래퍼 (`youtube.ts`, `claude.ts`)
- 테스트 파일은 대상과 같은 디렉토리에 `*.test.ts(x)`
- 경로 alias: `@/` → `src/` (vite.config.ts와 tsconfig.json의 paths에 동시 설정)

### 의존 방향 (단방향)

```
components → lib → services → 외부 API
components → types
lib → types
services → types
```

- 역방향 import 금지. services가 components/lib 이름을 알면 안 됨.
- 같은 레이어 형제 모듈 간 import는 허용 (예: `lib/analyze.ts` → `lib/cache.ts`).
- `lib/` 안에서 React hook (`useApiKeys`, `useOnlineStatus`, `useDocumentTitle`, `useUrlHash`, `useFocusTrap`)은 lib에 둠. components만 호출.

### 파일 명명

- 컴포넌트 파일·디폴트 export: PascalCase (`UrlInput.tsx`, `export default function UrlInput`)
- hook 파일: camelCase, prefix `use` (`useApiKeys.ts`)
- 유틸/서비스 파일: camelCase (`videoId.ts`, `youtube.ts`)
- 타입 전용 파일: camelCase (`report.ts`, `errors.ts`)
- 테스트: `<원본>.test.ts(x)`

## 코드 스타일

### TypeScript

- `any` 금지. boundary에서만 `unknown` 허용하고 즉시 좁힌다.
- `as` 캐스팅 최소화. 필요하면 zod parse로 대체.
- exported 함수/상수는 명시적 타입 시그니처를 가진다. 내부 변수는 추론 허용.
- non-null assertion (`!`) 금지. 옵셔널 체이닝 + 가드로 처리.
- enum 대신 union literal type (`type Status = "idle" | "loading"`).
- 함수 매개변수 4개 초과 시 옵션 객체로 감싼다.

### React

- 함수형 컴포넌트만. 클래스 컴포넌트 금지 (단 ErrorBoundary는 예외 — React가 클래스만 지원).
- 모든 hook 호출은 컴포넌트 최상위. 조건문/반복문 내부 호출 금지.
- `useEffect` 의존성은 ESLint `react-hooks/exhaustive-deps` 준수.
- list rendering 시 stable key 사용. **index를 key로 쓰지 마라** (댓글 id 등 도메인 식별자 사용).
- prop drilling 3단계 초과 시 context로 승격.
- `dangerouslySetInnerHTML` 금지. 사용자 입력은 React 기본 escape에만 의존.

### 에러 처리

- 모든 Promise는 끝에 catch 또는 try/catch.
- catch 안에서 raw Error 그대로 re-throw 금지. 도메인 에러로 변환.
- `console.error`는 boundary(top-level App ErrorBoundary, services)에서만. 컴포넌트 내부에서 `console.*` 금지.
- 에러 메시지(`userMessage`)는 한국어 + 다음 행동 명시.
- `AbortError`는 사용자에게 표시하지 않는다 (의도된 취소).

### 주석

- WHY만 적는다. WHAT은 코드가 설명.
- TODO는 이슈/PR 링크와 함께. 익명 TODO 금지.
- 함수 docstring/JSDoc은 외부 API(services 시그니처) 한정.

### 보안

- API 키는 localStorage 평문 저장 (BYOK의 한계). 화면 표시는 마스킹 (`••••••a8k2`).
- XSS 표면 최소화 위해 `dangerouslySetInnerHTML` 금지, 사용자 입력 댓글은 React escape에 의존.
- 외부 링크는 `target="_blank" rel="noopener noreferrer"`.
- CSP 메타 태그 (`index.html`):
  - `default-src 'self'`
  - `connect-src 'self' https://youtube.googleapis.com https://api.anthropic.com`
  - `style-src 'self' 'unsafe-inline'` (Tailwind)
  - `img-src 'self' https://i.ytimg.com data:`
- 사용자 입력 URL은 fetch에 직접 안 넣음 — videoId 추출 후 API URL 템플릿화.

## 개발 프로세스

- CRITICAL: TDD — 실패하는 테스트 먼저 → 통과 구현.
- CRITICAL: 한 PR/커밋은 한 가지 일만. 무관한 리팩터 섞지 마라.
- 커밋 메시지: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Push 전 반드시 `npm run build && npm test && npm run lint` 통과.
- 빌드는 `tsc --noEmit && vite build` (타입 에러도 빌드 실패).

## 명령어

```
npm run dev        # 개발 서버 (Vite, 기본 :5173)
npm run build      # tsc --noEmit && vite build → dist/
npm run preview    # dist/ 미리보기
npm run lint       # eslint src --max-warnings 0
npm run test       # vitest run
npm run test:watch # vitest watch
```

## 배포

- 정적 호스팅 (GitHub Pages / Vercel static / Cloudflare Pages 중 택1)
- 빌드 산출물: `dist/`
- 환경변수 사용 금지 (API 키는 런타임 입력)
- GitHub Pages 사용 시 `vite.config.ts`의 `base`를 `/{repo}/`로 설정
