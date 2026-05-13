# Step 7: shell-components

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 컴포넌트 계층, ErrorBoundary, Toast, aria-live
- `/docs/PRD.md` — Header/Footer/ErrorBoundary/Toast/OfflineBanner 카피
- `/docs/UI_GUIDE.md` — Header/Footer/Toast/OfflineBanner/접근성
- `/docs/ADR.md` — ADR-025 (안전망 3종), ADR-027 (접근성), ADR-028 (카피 SSOT), ADR-030 (프라이버시)

step 2 산출물:
- `src/lib/copy.ts`

step 3 산출물:
- `src/lib/online.ts`

## 작업

App 통합 전 안전망/외곽 컴포넌트를 만든다. 각자 독립적으로 렌더 가능.

### 1. `src/components/Header.tsx`

```tsx
type Props = { onOpenSettings: () => void };
export default function Header({ onOpenSettings }: Props): JSX.Element;
```

- `<header>` 시맨틱
- 좌측 `<h1>{t("header.title")}</h1>` (UI_GUIDE 페이지 제목 스타일)
- 우측 설정 아이콘 버튼 (`aria-label={t("header.settings")}`)
- `min-h-[44px]`, focus ring (UI_GUIDE `focus-visible:ring-2 ring-white/40 ring-offset-2 ring-offset-[#0a0a0a]`)
- 44px 터치 영역 보장

### 2. `src/components/Footer.tsx`

```tsx
export default function Footer(): JSX.Element;
```

- `<footer>` 시맨틱, 좌측 정렬, `max-w-5xl`, `pb-[env(safe-area-inset-bottom)]`
- 3개 항목 수직 배치 (`space-y-2`, `text-neutral-500 text-xs`):
  - `t("footer.disclaimer")`
  - `t("footer.privacy")`
  - 외부 링크: `t("footer.source")` + 외부 링크 아이콘 (`↗` 또는 SVG)
- 외부 링크 `target="_blank" rel="noopener noreferrer"`
- 소스 URL 상수: `const SOURCE_URL = "https://github.com"` (placeholder. 실제 repo URL은 후속에서 사용자가 채움)

### 3. `src/components/ErrorBoundary.tsx`

**클래스 컴포넌트** (CLAUDE.md 예외 — React가 클래스만 지원):

```tsx
import { Component, type ReactNode, type ErrorInfo } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info);
    // 외부 전송 금지 (ADR-030)
  }

  private handleRefresh = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="...">
          <h1>{t("boundary.title")}</h1>
          <p>{t("boundary.body")}</p>
          <button onClick={this.handleRefresh}>{t("boundary.refresh")}</button>
          <p className="text-xs text-neutral-500">
            {t("boundary.reportSecondary")} <a href="..." target="_blank" rel="noopener noreferrer">↗</a>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Fallback UI 스타일은 UI_GUIDE 다크 톤. **새로고침이 기본 CTA**, 이슈 보고는 보조 (시각적으로 약한 텍스트 링크).

### 4. `src/components/Toast.tsx`

```tsx
import type { CopyKey } from "@/types/copy";

type Props = { messageKey: CopyKey | null; onDismiss: () => void };
export default function Toast({ messageKey, onDismiss }: Props): JSX.Element | null;
```

- `messageKey === null` → null 반환
- `useEffect`로 messageKey 변경 시마다 4초 타이머 설정 → `onDismiss` 호출. cleanup으로 clearTimeout.
- `.fade-in` 클래스 (reduce-motion 시 자동 비활성화)
- 우측 하단 fixed (`fixed bottom-4 right-4`), 모바일은 하단 중앙 (`sm:left-1/2 sm:-translate-x-1/2`)
- UI_GUIDE Toast 스타일 (`bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm rounded-lg`)
- `role="status"`, `aria-live="polite"`

### 5. `src/components/OfflineBanner.tsx`

```tsx
import { useOnlineStatus } from "@/lib/online";
import { OfflineError } from "@/types/errors";

export default function OfflineBanner(): JSX.Element | null;
```

- `useOnlineStatus()` 구독. `true`면 null.
- `false` → sticky 상단 배너 (UI_GUIDE OfflineBanner 스타일: `bg-[#f59e0b]/15 text-[#f59e0b] py-2 px-4`)
- 텍스트: `new OfflineError().userMessage` (errors.ts의 도메인 에러 메시지 사용)
- `role="status"`, `aria-live="polite"`

### 6. `src/components/AriaLive.tsx`

```tsx
type Props = { politeMessage?: string; assertiveMessage?: string };
export default function AriaLive({ politeMessage, assertiveMessage }: Props): JSX.Element;
```

- 시각적으로 숨김 (Tailwind `sr-only`)
- 두 div:
  - `<div role="status" aria-live="polite" aria-atomic="true">{politeMessage ?? ""}</div>`
  - `<div role="alert" aria-live="assertive" aria-atomic="true">{assertiveMessage ?? ""}</div>`

### 테스트

- Header: 설정 아이콘 클릭 → `onOpenSettings` 호출
- Footer: 3개 항목 렌더, 외부 링크 `rel="noopener noreferrer"`
- ErrorBoundary: 자식이 throw → fallback UI, 새로고침 버튼 mock
- Toast: `vi.useFakeTimers` + 4초 경과 → `onDismiss` 호출
- OfflineBanner: `useOnlineStatus` mock로 true/false 분기
- AriaLive: prop 변경 → 영역 업데이트

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/components/` 안 6개 파일(Header, Footer, ErrorBoundary, Toast, OfflineBanner, AriaLive) + 테스트
   - [ ] ErrorBoundary가 클래스 컴포넌트
   - [ ] 외부 링크 `rel="noopener noreferrer"`
   - [ ] Toast 4초 자동 dismiss
   - [ ] OfflineBanner가 online 시 null
   - [ ] focus ring 적용
   - [ ] 모든 인터랙티브 element `min-h-[44px]`
   - [ ] 카피는 모두 `t()` lookup (단 `OfflineBanner`는 OfflineError.userMessage 허용 — 어차피 같은 텍스트)
3. index.json 업데이트:
   - 성공 → `"summary": "shell 6종: Header, Footer, ErrorBoundary(class), Toast(4s), OfflineBanner(useOnlineStatus), AriaLive. PRD 카피 SSOT 준수."`

## 금지사항

- **services import 금지.** 이유: 의존 방향.
- **컴포넌트 안에 직접 fetch 호출 금지.**
- **`dangerouslySetInnerHTML` 금지.**
- **`console.log/error` 금지** (ErrorBoundary `componentDidCatch`만 예외).
- **외부 링크 `target="_blank"` 시 `rel="noopener noreferrer"` 누락 금지.**
- **App.tsx 수정 금지** (이 step). 이유: 자기완결성.
- **ErrorBoundary catch 결과를 외부 전송 금지** (analytics/sentry/fetch). 이유: ADR-030.
