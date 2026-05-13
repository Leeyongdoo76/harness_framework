# Step 8: input-flow-components

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/PRD.md` — B 플로우, F 플로우(데이터 삭제), 카피 표
- `/docs/ARCHITECTURE.md` — 컴포넌트 계층, focus management
- `/docs/UI_GUIDE.md` — 카드, 버튼, 입력 필드, 모달 디자인
- `/docs/ADR.md` — ADR-024 (메타 명시 트리거), ADR-027 (focus trap), ADR-028 (카피 SSOT), ADR-030 (프라이버시), ADR-021 (진행 UI 2단계)

step 1 산출물:
- `src/types/videoMeta.ts`, `src/types/errors.ts`

step 2 산출물:
- `src/lib/copy.ts`, `src/lib/videoId.ts`, `src/lib/clearAll.ts`

step 3 산출물:
- `src/lib/keys.ts` (maskKey), `src/lib/focusTrap.ts`

## 작업

입력 흐름 컴포넌트 5종.

### 1. `src/components/UrlInput.tsx`

```tsx
type Props = {
  value: string;
  onChange: (url: string) => void;
  onSubmit: (videoId: string) => void;
  disabled?: boolean;
};
export default function UrlInput(props: Props): JSX.Element;
```

규칙 (ADR-024):
- `onChange`는 단순 입력 갱신 (API 호출 없음)
- **`onBlur` 또는 `Enter` 키 → trim → `parseVideoId` → 성공 시 `onSubmit(videoId)` 호출**
- 실패 분기 (인라인 에러 표시):
  - 빈 / 공백만 → 에러 안 표시
  - 도메인 불일치 → `url.errorInvalidDomain`
  - videoId 추출 실패 → `url.errorInvalidVideo`
  - 플레이리스트 path → `url.errorPlaylist`
  - 채널 path (`/channel/`, `/@`, `/user/`, `/c/`) → `url.errorChannel`
- UI_GUIDE 입력 필드 스타일 + focus ring
- `<label htmlFor>` + `id` 연결 (a11y)
- placeholder는 `t("url.placeholder")`
- `autocomplete="off"`, `spellcheck={false}`

테스트:
- 입력 → blur → onSubmit 호출
- Enter 키 → onSubmit
- 잘못된 URL 4종 → 인라인 에러
- 빈 입력 → 에러 없음, onSubmit 안 호출
- `disabled` → 입력/제출 차단

### 2. `src/components/VideoMetaPreview.tsx`

```tsx
import type { VideoMeta } from "@/types/videoMeta";

type Props =
  | { kind: "loading" }
  | { kind: "ready"; meta: VideoMeta; onAnalyze: () => void; disabled?: boolean }
  | { kind: "fallback"; videoId: string; errorMessage: string; onAnalyze: () => void; disabled?: boolean };

export default function VideoMetaPreview(props: Props): JSX.Element;
```

- `loading` → 스켈레톤 카드 (썸네일 자리 + 두 줄 텍스트 자리, `animate-pulse` 또는 정적)
- `ready` → 썸네일(img with `alt={meta.title}`) + 제목 + `t("meta.channelLabel")` + 채널명 + `t("meta.commentCountLabel")` + `t("meta.commentCountFormat", { count: meta.commentCount ?? 0 })` + "분석 시작" Primary 버튼
- `fallback` → 회색 placeholder + `[videoId]` 제목 + `errorMessage` (text-neutral-400) + "분석 시작" 버튼 (활성화)
- UI_GUIDE 카드 스타일

### 3. `src/components/ApiKeyModal.tsx`

```tsx
type Props = {
  mode: "first" | "edit";
  currentKeys?: { youtube: string; anthropic: string };
  onSave: (keys: { youtube: string; anthropic: string }) => void;
  onClose?: () => void;
  onClearAll: () => void;
};
export default function ApiKeyModal(props: Props): JSX.Element;
```

규칙 (ADR-030):
- 모달 컨테이너 `useFocusTrap(ref, true, { allowEscape: mode === "edit", onEscape: onClose })`
- 두 input: `type="password"` 기본 + "보기/숨기기" 토글 (텍스트 버튼)
- placeholder는 카피 표 (`keys.youtubePlaceholder`, `keys.anthropicPlaceholder`)
- 각 input `autocomplete="off"`
- 발급 가이드 토글:
  - 접힌 상태: `t("keys.guideToggleClosed")` (펼치기 버튼)
  - 펼친 상태: 두 가이드(YouTube + Anthropic) + 외부 링크 (`t("keys.youtubeGuideLink")`, `t("keys.anthropicGuideLink")`)
  - **외부 링크 URL** (모듈 상수로 컴포넌트 상단에 선언):
    ```ts
    const YOUTUBE_GUIDE_URL = "https://console.cloud.google.com/apis/library/youtube.googleapis.com";
    const ANTHROPIC_GUIDE_URL = "https://console.anthropic.com/settings/keys";
    ```
  - 두 링크 모두 `target="_blank" rel="noopener noreferrer"` 필수
- "저장" 버튼: 두 입력값 모두 trim 후 비어있지 않을 때만 활성화
- "모든 데이터 삭제" Danger 스타일 버튼 → `ConfirmDialog` 띄움 → 확정 시 `onClearAll` 호출
- `mode === "edit"`이고 `currentKeys` 있으면 마스킹 표시 (`maskKey(currentKeys.youtube)` 같은)
- 모달 backdrop: `mode === "first"`는 클릭 무효, `mode === "edit"`는 backdrop 클릭으로 `onClose`

### 4. `src/components/ConfirmDialog.tsx`

```tsx
type Props = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "default" | "danger";
};
export default function ConfirmDialog(props: Props): JSX.Element;
```

- `useFocusTrap(ref, true, { allowEscape: true, onEscape: onCancel })`
- 확인 버튼은 `variant === "danger"`면 Danger 스타일
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`
- dialog 닫기는 호출자 책임 (이 컴포넌트는 단일 책임)

### 5. `src/components/ProgressIndicator.tsx`

```tsx
type Props = {
  phase: "fetching" | "analyzing";
  onCancel: () => void;
};
export default function ProgressIndicator(props: Props): JSX.Element;
```

- 단계 텍스트: `t("progress.fetching")` 또는 `t("progress.analyzing")`
- 작은 spinner (CSS animation, reduce-motion에서 자동 정지 — `index.css`의 미디어 쿼리)
- 예상 시간 보조 텍스트: `t("progress.estimate")` (`text-xs text-neutral-500`)
- 취소 버튼: `t("progress.cancel")` (Text 스타일) → `onCancel`
- 중앙 정렬 (UI_GUIDE 로딩 예외)

### 테스트

- **UrlInput**: 빈/공백/도메인 불일치/videoId 실패/플레이리스트/채널 → 각 에러 / blur 또는 Enter에서 onSubmit
- **VideoMetaPreview**: 3분기 렌더, "분석 시작" 클릭 → onAnalyze
- **ApiKeyModal**: `mode="first"`에서 ESC 무시, `mode="edit"`에서 ESC → onClose, 저장 검증, "모든 데이터 삭제" → ConfirmDialog → onClearAll
- **ConfirmDialog**: confirm/cancel 콜백, ESC → onCancel
- **ProgressIndicator**: 2단계 텍스트, 취소 → onCancel

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/components/` 안 5개 파일 + 테스트
   - [ ] `UrlInput`이 blur/Enter 양쪽 모두에서 onSubmit
   - [ ] `UrlInput` debounce/setTimeout 없음 (입력 중 호출 없음)
   - [ ] `ApiKeyModal mode="first"` ESC/배경 클릭 차단
   - [ ] 모든 카피 `t()` lookup
   - [ ] 모달 2종 focus trap 적용
   - [ ] 44px 터치 영역, focus ring
   - [ ] API 키 입력 필드 `autocomplete="off"`
3. index.json 업데이트:
   - 성공 → `"summary": "input-flow 5종: UrlInput(blur/Enter), VideoMetaPreview(3분기), ApiKeyModal(focus trap + 가이드 토글 + clear all), ConfirmDialog, ProgressIndicator(2 phase + cancel)."`

## 금지사항

- **`UrlInput`에 debounce/setTimeout 자동 호출 금지.** blur/Enter만. 이유: ADR-024 (BYOK 쿼터 보호).
- **API 키 input에 `autocomplete="off"` 누락 금지.**
- **`needs_keys` 모달에서 ESC/backdrop 클릭 닫기 허용 금지.** 이유: ADR-030.
- **services import 금지.**
- **외부 링크 `rel="noopener noreferrer"` 누락 금지.**
- **카피를 임의 작성 금지.** PRD 카피 표만. 이유: ADR-028.
