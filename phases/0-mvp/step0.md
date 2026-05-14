# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` — 기술 스택, CRITICAL 규칙, 코드 스타일
- `/docs/PRD.md` — 제품 요구, 마이크로 카피 표
- `/docs/ARCHITECTURE.md` — 디렉토리 구조, 의존 그래프
- `/docs/ADR.md` — 32개 결정 사항
- `/docs/UI_GUIDE.md` — 디자인 가이드 (색상, 컴포넌트, 접근성)

특히 다음 ADR을 자세히 확인하라:
- **ADR-001** Vite + React + TypeScript 스택
- **ADR-003** Claude Haiku 4.5 + system string (cache_control 폐기, PoC 검증 결과)
- **ADR-016** 매 step AC에 build + test + lint
- **ADR-017** TypeScript strict 옵션
- **ADR-018** CSP 메타 태그
- **ADR-027** prefers-reduced-motion 대응
- **ADR-031** Anthropic 브라우저 직접 호출 (`dangerouslyAllowBrowser`) — 이 step의 PoC 대상
- **ADR-032** Playwright smoke

현재 프로젝트 루트는 부트스트랩 전 상태다 (`package.json`/`src/`/`node_modules/` 모두 없음). docs와 CLAUDE.md만 존재한다.

## 작업

이 step은 두 부분으로 구성된다.

### Part A — 프로젝트 부트스트랩

루트(`C:\Project\claudecode\harness_framework`)에 Vite + React + TypeScript 정적 SPA 프로젝트를 만든다.

1. **`package.json`**
   - 이름 `youtube-comment-analyzer`, `private: true`
   - scripts: `dev` (vite), `build` (`tsc --noEmit && vite build`), `preview`, `lint` (`eslint src --max-warnings 0`), `test` (`vitest run`), `test:watch` (`vitest`), `poc` (`tsx scripts/anthropic-poc.ts`)

2. **의존성**
   - 런타임: `react@^18`, `react-dom@^18`, `@anthropic-ai/sdk` (최신), `zod@^3`, `recharts@^2`
   - 개발: `vite@^5`, `@vitejs/plugin-react`, `typescript@^5`, `@types/react`, `@types/react-dom`, `tailwindcss@^3`, `postcss`, `autoprefixer`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y`, `prettier`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `happy-dom`, `@playwright/test`, `tsx`
   - **금지 의존성** (CLAUDE.md 참조): moment, dayjs, lodash, react-router, Zustand, Redux, jotai, styled-components, emotion, axios, jQuery, 분석/추적 SDK

3. **`tsconfig.json`** (ADR-017 강제):
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "useDefineForClassFields": true,
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "jsx": "react-jsx",
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "exactOptionalPropertyTypes": true,
       "noImplicitOverride": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noFallthroughCasesInSwitch": true,
       "skipLibCheck": true,
       "allowSyntheticDefaultImports": true,
       "isolatedModules": true,
       "resolveJsonModule": true,
       "baseUrl": ".",
       "paths": { "@/*": ["./src/*"] }
     },
     "include": ["src", "scripts"]
   }
   ```

4. **`vite.config.ts`**: `@vitejs/plugin-react`, `@` alias = `./src`, `server.port: 5173`. GitHub Pages 배포 대응 위해 `base`는 환경변수 또는 주석 처리된 옵션으로 두기.

5. **`vitest.config.ts`**: `environment: "happy-dom"`, `globals: true`, `setupFiles: ["./src/test-setup.ts"]`. `src/test-setup.ts`에서 `@testing-library/jest-dom` import.

6. **`tailwind.config.js`**: `content: ["./index.html", "./src/**/*.{ts,tsx}"]`

7. **`postcss.config.js`**: tailwindcss + autoprefixer

8. **`playwright.config.ts`**: chromium 기본, `baseURL: "http://localhost:5173"`, `webServer: { command: "npm run dev", port: 5173 }`. step 11에서 본격적으로 사용하므로 여기선 빈 `tests/e2e/` 디렉토리만 만들고 설정만.

9. **`eslint.config.js`** (flat config 권장): typescript-eslint recommended + react-hooks + react-refresh + **jsx-a11y recommended**. `--max-warnings 0` 통과해야 함.

10. **`prettier.config.cjs`**: 기본 + `endOfLine: "lf"` (한국어 주석/문자열 안전성).

11. **`index.html`** — ADR-018 CSP 메타 태그 그대로:
    ```html
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; connect-src 'self' https://www.googleapis.com https://youtube.googleapis.com https://api.anthropic.com; style-src 'self' 'unsafe-inline'; img-src 'self' https://i.ytimg.com data:; font-src 'self';"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta
          name="description"
          content="YouTube 영상의 댓글을 자동으로 분석해 크리에이터를 위한 피드백 리포트를 제공합니다."
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>YouTube 댓글 분석</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body>
    </html>
    ```

12. **`public/favicon.svg`** — 단순 SVG 아이콘 (다크 배경에서 보이도록 흰색 또는 밝은 색).

13. **`src/index.css`** — Tailwind directives + fade-in keyframe + reduce-motion (ADR-027):
    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-in { animation: fadeIn 0.4s ease-out both; }

    @media (prefers-reduced-motion: reduce) {
      .fade-in { animation: none; }
      *, *::before, *::after {
        transition: none !important;
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
      }
    }

    body {
      background-color: #0a0a0a;
      color: rgb(229 229 229);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
        Roboto, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    }
    ```

14. **`src/main.tsx`**:
    - React 18 `createRoot`
    - `<StrictMode>` 안에 `<App />`
    - `ErrorBoundary` 래핑은 step 7에서 추가 (이 step에서는 placeholder OK)

15. **`src/App.tsx`**: placeholder 컴포넌트 1개. `<h1>YouTube 댓글 분석</h1>` 정도. CLAUDE.md "마이크로 카피는 PRD SSOT" 규칙 때문에 실제 문구 박지 말고 임시 텍스트만. 후속 step에서 `lib/copy.ts`로 갈아끼움.

16. **`src/App.test.tsx`** — 빈 더미 테스트:
    ```tsx
    import { render, screen } from "@testing-library/react";
    import App from "./App";

    test("renders heading", () => {
      render(<App />);
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    ```

17. **`.gitignore`** — 기존 항목 유지하면서 다음 추가: `node_modules/`, `dist/`, `coverage/`, `.env`, `.env.*`, `playwright-report/`, `test-results/`

18. **Playwright 브라우저 바이너리 설치** (ADR-032 사전 준비): `npm install` 직후 `npx playwright install chromium`을 1회 실행한다. step 11 e2e 시나리오가 chromium을 요구하므로 step 0에서 미리 설치해 후속 step의 의존 누락을 방지한다. execute.py가 step 0 셸 실행 단계에 이 명령도 포함하도록 한다.

### Part B — Anthropic 브라우저 호출 PoC (ADR-031)

`scripts/anthropic-poc.ts` 작성. **정식 코드가 아닌 부트스트랩 검증용 스크립트**. Node에서 1회 실행해 브라우저 호출 가정 검증.

요구 사항:
1. `import Anthropic from "@anthropic-ai/sdk"`
2. `process.env.ANTHROPIC_API_KEY`에서 키 읽음. 미설정이면 에러 후 종료.
3. `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })` — SDK가 이 옵션을 받는지 타입 + 런타임 확인.
4. `client.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 100, system: [{ type: "text", text: "Reply with exactly: {\"ok\":true}", cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: "ping" }] })` 호출.
5. 응답에서 `usage.cache_creation_input_tokens` / `usage.cache_read_input_tokens` 값을 콘솔에 출력.
6. 응답 텍스트(`response.content[0].text`)를 콘솔에 출력.
7. 동일 호출을 한 번 더 반복해 두 번째 응답에서 `cache_read_input_tokens > 0` 확인 → 캐시 hit 검증.
8. 에러 시 명확한 메시지 출력 후 비정상 종료(exit 1).

실행 방법 (사용자 수동):
```bash
ANTHROPIC_API_KEY=sk-ant-... npm run poc
```

**검증 기준**:
- 첫 호출 200 OK
- 두 번째 호출 `usage.cache_read_input_tokens > 0`

**PoC 실패 시 분기**:
- SDK 타입이 `dangerouslyAllowBrowser`를 받지 않음 → SDK 버전 재확인 → 여전히 미지원이면 step을 **blocked** 처리, `blocked_reason: "@anthropic-ai/sdk 버전 X.Y가 dangerouslyAllowBrowser 미지원"`.
- 200 OK인데 `cache_*` 필드가 응답에 없음 → 응답 타입 확인 후 system 구조 수정 시도. 시도 후에도 캐시 동작 안 하면 **error**, `error_message: "system content block + cache_control 응답에 cache_creation/read_input_tokens 미포함"`. ADR-003 재검토 필요함을 명시.
- 그 외 에러는 3회 재시도 정책 적용 (execute.py 표준).

**참고**: execute.py는 PoC를 자동 실행하지 않는다 (실제 API 키 필요). PoC는 사용자가 step 5 시작 전 직접 1회 돌리고 결과를 `phases/0-mvp/index.json`의 step 0 `summary`에 기록해야 한다. step 0의 completed 처리 자체는 빌드/테스트/린트 통과만으로 가능.

## Acceptance Criteria

다음 커맨드가 모두 통과:

```bash
npm install
npm run build
npm run lint
npm test
```

추가 (수동, AC 비포함):
```bash
ANTHROPIC_API_KEY=sk-ant-... npm run poc
```

## 검증 절차

1. AC 커맨드 4개 실행 (npm install 포함).
2. 아키텍처 체크리스트:
   - [ ] `tsconfig.json`이 ADR-017의 모든 strict 옵션 포함
   - [ ] `index.html`의 CSP 메타 태그가 ADR-018과 1:1 일치
   - [ ] `src/index.css`에 reduce-motion 미디어 쿼리 존재
   - [ ] `@/` alias가 `vite.config.ts` + `tsconfig.json` 모두에 설정
   - [ ] `eslint.config.js`에 jsx-a11y 플러그인 포함
   - [ ] `package.json`의 scripts 7개(`dev/build/preview/lint/test/test:watch/poc`) 모두 존재
   - [ ] 금지 의존성(lodash, axios, moment, dayjs, jQuery, react-router, Zustand 등)이 `package.json`에 없음
   - [ ] `.gitignore`에 `node_modules`, `dist`, `coverage`, `.env*`, `playwright-report`, `test-results` 포함
   - [ ] `scripts/anthropic-poc.ts` 파일이 존재하고 위 8개 요구 사항을 충족
3. `phases/0-mvp/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Vite + React 18 + TS strict + Tailwind + 도구 체인 설치. Playwright chromium 설치. CSP/reduce-motion 적용. PoC 스크립트 scripts/anthropic-poc.ts 작성. **PoC 미검증 — step 5 시작 전 사용자가 'ANTHROPIC_API_KEY=sk-ant-... npm run poc' 수동 실행 후 결과(첫 호출 200 OK + 두 번째 cache_read_input_tokens > 0)를 이 summary 끝에 추가해야 함. 미기록 시 step 5가 blocked로 자동 종료된다.**"`
   - 빌드/테스트/린트 3회 시도 후 실패 → `"status": "error"`, `"error_message": "<구체 에러>"`
   - SDK가 PoC 옵션을 받지 못해 차단 → `"status": "blocked"`, `"blocked_reason": "<구체 사유>"`

## 금지사항

- **API 키를 코드/번들/.env 파일에 박지 마라.** PoC는 `process.env.ANTHROPIC_API_KEY` 한정. 이유: ADR-002 BYOK 위반.
- **streaming API 사용 금지.** PoC도 single-shot. 이유: ADR-019.
- **`any` 사용 금지, non-null assertion (`!`) 금지.** 이유: ADR-017.
- **CSP 메타 태그의 화이트리스트를 임의로 완화하지 마라** (`unsafe-eval` 추가 등). 이유: ADR-018.
- **다른 패키지 매니저(yarn, pnpm) 사용 금지.** npm 고정. 이유: CLAUDE.md (lock 파일 단일화).
- **임의로 `cache_control` 부착 금지.** ADR-003 — PoC 결과 우리 SYSTEM_PROMPT 가 캐시 임계값 미달이라 부착해도 캐시 동작 안 함. system 은 단순 string 으로 전달.
- **`src/` 하위에 services/lib/components 파일을 미리 만들지 마라.** 이 step은 부트스트랩 + 빈 App.tsx만. 실제 모듈은 step 1부터. 이유: 자기완결성 — 후속 step이 자기 영역을 만든다.
- **존재하는 기존 docs/CLAUDE.md를 수정하지 마라.** 이 step은 코드 추가만. 이유: 가드레일 변경 금지.
