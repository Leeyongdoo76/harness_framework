# Step 3: lib-hooks

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — API 키 관리, URL hash, 페이지 title, online, focus trap, aria-live
- `/docs/ADR.md` — ADR-026 (hash), ADR-027 (focus/접근성)

step 1 산출물:
- `src/types/copy.ts`

step 2 산출물:
- `src/lib/storage.ts`, `src/lib/copy.ts`

## 작업

React hook을 `src/lib/`에 만든다. 컴포넌트(`.tsx`)는 만들지 않는다.

### 1. `src/lib/keys.ts`

```ts
export type ApiKeys = { youtube: string; anthropic: string };

export function loadKeys(): ApiKeys | null;
export function saveKeys(keys: ApiKeys): void;
export function clearKeys(): void;
export function maskKey(key: string): string;

export function useApiKeys(): {
  keys: ApiKeys | null;
  save: (keys: ApiKeys) => void;
  clear: () => void;
};
```

규칙:
- 저장 키: `keys:youtube`, `keys:anthropic` (storage.ts 통해서만)
- `loadKeys`: 둘 다 비어있지 않을 때만 반환, 하나라도 비면 `null`
- `saveKeys`: trim 후 빈이면 throw (UI에서 사전 검증하므로 사실상 안 일어남)
- `useApiKeys`는 `useSyncExternalStore` 사용 (모든 컴포넌트 동기화)
- 외부 변경 알림용 `EventTarget` 모듈 변수
- `maskKey`: 8자 미만 전부 마스킹, 8자 이상 마지막 4자만 노출 (예: `••••••••a8k2`)

테스트: load/save/clear, 빈 차단, mask 케이스, hook 구독 동기화.

### 2. `src/lib/online.ts`

```ts
export function useOnlineStatus(): boolean;
```

- `navigator.onLine` 초깃값
- `window.addEventListener("online" | "offline", ...)` 갱신
- cleanup에서 `removeEventListener`

테스트: 이벤트 발화 → 상태 변경.

### 3. `src/lib/urlHash.ts`

```ts
export function parseHashVideoId(hash: string): string | null;
export function buildHash(videoId: string): string;

export function useUrlHash(): {
  videoId: string | null;
  setVideoId: (id: string | null) => void;
};
```

규칙 (ADR-026):
- 초깃값: `parseHashVideoId(window.location.hash)`
- `setVideoId(id)`:
  - id가 null이면 `history.replaceState(null, "", window.location.pathname + window.location.search)`
  - id가 있으면 `history.replaceState(null, "", buildHash(id))`
- **`pushState` 절대 금지** (history 오염)
- `hashchange` 이벤트 listen → 외부 변경(뒤로/앞으로) 시 상태 갱신
- `parseHashVideoId` 정규식: `/^#v=([A-Za-z0-9_-]{11})$/` — 형식 안 맞으면 null
- `buildHash(id)`: `"#v=" + id`

테스트: 파싱 정/오 케이스, set 후 location.hash 변경, hashchange 발화 처리.

### 4. `src/lib/pageTitle.ts`

```ts
export function useDocumentTitle(title: string): void;
```

- `useEffect`로 `document.title = title`
- cleanup 불필요 (App이 항상 title 관리)

테스트: title 변경 검증.

### 5. `src/lib/focusTrap.ts`

```ts
import type { RefObject } from "react";

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  options?: { onEscape?: () => void; allowEscape?: boolean }
): void;
```

규칙 (ADR-027):
- `active=true` 시:
  1. 활성화 전 `document.activeElement`를 ref에 저장
  2. ref 컨테이너 안 첫 focusable element에 focus
     - selector: `button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`
  3. `keydown` listener:
     - Tab: 마지막 element면 첫으로 wrap
     - Shift+Tab: 첫 element면 마지막으로 wrap
     - Escape: `options.allowEscape !== false`(즉 기본 true)이면 `onEscape` 콜백. 단 **`allowEscape: false` 명시 시 ESC를 차단**.
- `active=false` 또는 cleanup → 저장된 element에 focus 복귀

테스트: focus 진입/이탈, Tab wrap, ESC 허용/금지.

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/lib/` 5개 파일(`keys`, `online`, `urlHash`, `pageTitle`, `focusTrap`) 존재
   - [ ] `useApiKeys`가 `useSyncExternalStore` 사용
   - [ ] `useUrlHash`가 `replaceState` 사용 (pushState 없음)
   - [ ] `useFocusTrap` `allowEscape: false` 시 ESC 차단
   - [ ] 어떤 hook도 services import 없음
   - [ ] `.tsx` 파일 생성 없음
3. index.json 업데이트:
   - 성공 → `"summary": "React hook 5종: useApiKeys(useSyncExternalStore), useOnlineStatus, useUrlHash(replaceState), useDocumentTitle, useFocusTrap(allowEscape 옵션)."`

## 금지사항

- **`.tsx` 컴포넌트 파일 생성 금지.** 컴포넌트는 step 7부터. 이유: 자기완결성.
- **services import 금지.** 이유: 의존 방향.
- **`history.pushState` 사용 금지.** `replaceState`만. 이유: ADR-026.
- **localStorage 직접 접근 금지.** `lib/storage.ts`의 `getStore()`만. 이유: ADR-012 (fallback 일관성).
- **`any`/`!` 금지.**
