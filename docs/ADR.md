# Architecture Decision Records

## 철학
MVP 속도 최우선. 서버·로그인·DB 없는 정적 SPA. 외부 의존성 최소화. BYOK(사용자가 본인 키). **에러는 침묵하지 않고 사용자에게 다음 행동을 명시한다. 모든 외부 에러는 services 경계에서 도메인 에러로 변환된다. 마이크로 카피는 PRD 카피 표를 단일 진실 출처로 한다. 사용자의 입력과 결과는 새로고침/뒤로가기에서도 잃지 않는다. 외부 SDK 동작 가정은 step 0 PoC로 검증한 뒤 확정한다.**

---

### ADR-001: Vite + React + TypeScript 스택
**결정**: Next.js 대신 Vite로 정적 SPA를 빌드한다.
**이유**: 서버/라우팅/SSR 불필요. Vite는 빌드가 가볍고 정적 호스팅과 짝이 좋다.
**트레이드오프**: Next.js 생태계의 편의 포기.

### ADR-002: BYOK (Bring Your Own Key) 모델
**결정**: 사용자가 본인 YouTube/Anthropic 키를 입력하고 localStorage에만 보관한다.
**이유**: 서버 없는 제약에서 비용 분산과 키 보호 양립.
**트레이드오프**: 진입 장벽 — 발급 가이드로 완화.

### ADR-003: Claude Haiku 4.5 + 시스템 프롬프트 캐싱 (content block 배열 형식)
**결정**: 모델 `claude-haiku-4-5-20251001`. system은 **content block 배열** 형식으로 보낸다:
```ts
system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]
```
- `cache_control`은 system 문자열이 아닌 **content block에 부착**해야 캐시 동작 (Anthropic API 명세).
- 캐시 TTL 5분.
- step 0 PoC에서 실제 캐시 hit 응답(`cache_read_input_tokens`)을 확인하여 작동 검증.

**이유**: 댓글 100개 분석에 Haiku 4.5의 품질·비용·속도 균형 최적. 연속 분석 시 캐시 히트로 절감. content block 배열은 SDK 타입과 일치 + 캐시 작동 보장.

**트레이드오프**: SDK 타입 정의에 맞춰야 함. 미묘한 톤 분석 정확도 손실 가능.

### ADR-004: 댓글 100개 / 톱-레벨만 / order=relevance / pageToken 미사용
**결정**: `commentThreads.list`, `maxResults=100` (한 페이지 최대), `order=relevance`, top-level only, **`pageToken` 사용 안 함** — 첫 응답 페이지만 분석.

**이유**: 1회 Claude 호출로 처리. relevance가 신호 대비 노이즈 낮음. 페이지네이션으로 200+ 댓글까지 늘리면 토큰·쿼터·복잡도가 모두 증가하는데 MVP 가치 작음.

**트레이드오프**: long-tail 신호 누락. 향후 옵션으로 추가 가능.

### ADR-005: localStorage 캐시 — 분석 결과 30일 / 메타 1시간
**결정**:
- 분석 결과: `report:{videoId}`, TTL 30일. 값에 `schemaVersion`, `createdAt`, `videoMeta`, `report` 포함.
- 영상 메타: `videometa:{videoId}`, TTL 1시간 (별도 캐시).

**이유**: 메타는 자주 안 변하고 BYOK 쿼터 보호에 효과. 분석 결과는 댓글 누적 변화 고려해 30일.

**트레이드오프**: 캐시 레이어 2개로 코드 복잡도 약간 증가.

### ADR-006: zod로 Claude 응답 런타임 검증
**결정**: zod parse. 실패 시 위반 정보를 system에 첨부해 1회 재시도, 그래도 실패면 `ClaudeSchemaError`.
**이유**: LLM 스키마 일탈 가능성. 입구에서 검증해 UI 안전.
**트레이드오프**: 재시도 비용/지연.

### ADR-007: 라우터/외부 상태 라이브러리 없음
**결정**: useState/useReducer만. context는 prop drilling 3단계 초과 시.
**이유**: 단순 상태. 추가 추상화 비용 > 이득.
**트레이드오프**: 화면 확장 시 재도입 필요.

### ADR-008: 도메인 에러 클래스 계층
**결정**: `AppError` 추상 + 하위 구체 에러. 공통: `code`, `userMessage`, `cause?`, `retriable`.
**이유**: 컴포넌트가 `code`로 분기, `userMessage`로 표시 → 변경에 강함.
**트레이드오프**: services 매핑 코드 집중.

### ADR-009: 재시도 정책 — 지수 백오프 + 4xx 비재시도
**결정**: 5xx/429/네트워크 백오프 자동 재시도. 4xx 즉시 사용자 알림.
**이유**: 일시적 장애 흡수 + 영구 실패 빠른 인지.
**트레이드오프**: 최악 지연 ~7초.

### ADR-010: 토큰 한도 초과 시 댓글 truncation + evidence hallucination 제거
**결정**:
- token 초과 → likeCount 상위 50개로 자르고 1회 재시도. Report에 `truncatedCount` 표시.
- 응답 evidence가 입력 댓글에 substring 일치하지 않으면 제거 (services 후처리).

**이유**: 신호 강한 댓글로 분석 살리기 + LLM hallucination 차단.
**트레이드오프**: 절반 누락 + evidence 빈 strength/improvement 항목은 제거되어 결과 카드가 비어 보일 수 있음.

### ADR-011: AbortController로 동시성 제어
**결정**: reducer가 controller 보유. URL 변경/취소/키 삭제 시 abort. services에 signal 주입. stale 응답 drop.
**이유**: stale 응답 차단의 가장 깔끔한 방법.
**트레이드오프**: SDK signal 미지원 버전은 결과 무시 분기.

### ADR-012: localStorage 비활성 / quota fallback
**결정**: storage.ts에서 SecurityError/QuotaExceededError 잡아 인메모리 fallback. 1회 토스트.
**이유**: Safari private mode 등에서 앱 죽지 않게.
**트레이드오프**: 세션 한정 동작.

### ADR-013: 단방향 의존 + 도메인 에러 변환 boundary
**결정**: services → lib → components 단방향. raw 에러는 services에서 변환.
**이유**: 변경에 강함, 컴포넌트 표면 최소.
**트레이드오프**: 매핑 코드 집중.

### ADR-014: 테스트 — Vitest + @testing-library/react + happy-dom
**결정**: 단위/컴포넌트는 Vitest + happy-dom + user-event.
**이유**: Vite 통합 + happy-dom 빠름.
**트레이드오프**: happy-dom 일부 API 미지원.

### ADR-015: i18n — UI 한국어 고정, 분석 결과만 다국어
**결정**: UI 한국어. 분석 결과는 댓글 주 언어. `detectedLanguage` 필드.
**이유**: MVP 주 사용자 한국어 크리에이터.
**트레이드오프**: 일/영 채널 운영자는 UI 불편.

### ADR-016: 매 step AC에 빌드 + 테스트 + 린트 포함
**결정**: 각 step AC에 `npm run build && npm test && npm run lint`.
**이유**: 깨진 토대 위 후속 step 방지.
**트레이드오프**: step 0부터 모든 검사 통과 필요.

### ADR-017: TypeScript strict + noUncheckedIndexedAccess
**결정**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. `any` 금지, `!` 금지.
**이유**: LLM 코드의 미세 버그를 타입 시스템으로 강제.
**트레이드오프**: 코드 살짝 verbose.

### ADR-018: CSP 메타 태그로 외부 호출 제한 (강화)
**결정**: `index.html`에 다음 CSP 박는다:
```
default-src 'self';
script-src 'self';
base-uri 'none';
object-src 'none';
form-action 'none';
connect-src 'self' https://youtube.googleapis.com https://api.anthropic.com;
style-src 'self' 'unsafe-inline';
img-src 'self' https://i.ytimg.com data:;
font-src 'self';
```
**이유**: BYOK 환경에서 의도치 않은 외부 호출/스크립트 인젝션/iframe 임베드/폼 탈취를 정적 단계에서 차단.
**트레이드오프**: CDN/외부 폰트/분석 도구 도입 시 CSP 갱신 필요 (의도된 제약).

### ADR-019: 분석 호출은 single-shot, streaming 미사용
**결정**: Anthropic streaming API 미사용.
**이유**: JSON 한 덩어리 + zod 검증 필요.
**트레이드오프**: 진행 시각화는 단계 텍스트로.

### ADR-020: 댓글 텍스트는 `textOriginal`
**결정**: `textOriginal` 사용. `textDisplay` 미사용.
**이유**: HTML 엔티티 노이즈 제거.
**트레이드오프**: raw 줄바꿈/공백 (문제 없음).

### ADR-021: 분석 진행 UI는 2단계 텍스트 + 명시 취소 + 예상 시간
**결정**: "댓글 모으는 중…" / "AI 분석 중…" + 취소 버튼 + "보통 20~30초". 진행률 % 표시 안 함.
**이유**: 가짜 progress 신뢰 훼손. 텍스트가 정직.
**트레이드오프**: 체감 시간 길어질 수 있음.

### ADR-022: 에러 후 이전 상태로 복귀 + 중첩 방지 + 인증 에러 자동 복귀
**결정**:
- error 상태는 `previous` 보유. "다시 시도" → previous.
- **error 상태에서 `FAILED` 추가 발생 시 기존 previous를 그대로 유지** (error → error → error로 nesting되지 않음).
- **인증 에러 후 KEYS_SAVED 시 `error → previous` 자동 복귀** (idle로 떨어뜨리지 않음 — 사용자가 입력한 URL/메타 컨텍스트 유지).
**이유**: 사용자가 에러 발생 시점의 작업 컨텍스트를 잃지 않게.
**트레이드오프**: reducer 복잡도 증가 — reducer 테스트로 모든 (state, action) 매트릭스를 검증.

### ADR-023: localStorage 키 prefix 규칙
**결정**: `keys:*`, `report:*`, `videometa:*`, `flag:*` prefix. "모든 데이터 삭제"는 4개 prefix 전부 제거.
**이유**: 충돌 방지 + 일괄 정리.
**트레이드오프**: 컨벤션 학습 비용.

### ADR-024: 영상 메타 미리보기 — 명시 트리거 + de-dupe + abort + 1시간 캐시
**결정**:
- URL 입력 onChange에서는 형식 검증만. **API 호출은 사용자의 blur 또는 Enter 키 입력 시에만**.
- 같은 videoId 재요청 안 함 (videoId de-dupe).
- 진행 중 호출 abort 후 새 호출.
- 결과는 `videometa:{videoId}` 키로 1시간 TTL 캐시. 캐시 hit 시 호출 안 함.
- 메타 실패(5xx/네트워크)는 silent (`meta.metaLoadError` 표시 + `[videoId]` fallback) — 분석은 진행 가능.
- 메타 4xx auth → `meta.metaAuthError` + 설정 모달 자동 오픈 + 분석 차단.
- 메타 404 OR 200+items=[] → `YT_NOT_FOUND` + 분석 차단.

**이유**: debounce 자동 호출은 사용자가 URL을 수정하는 동안 BYOK 쿼터를 소모. 명시 트리거 + de-dupe + abort + 캐시로 호출 횟수 최소화. 동시에 사용자 친절도(메타 실패해도 분석 진행 가능, 키 문제는 명확히 안내)를 유지.

**트레이드오프**: blur 발생까지 미리보기가 없음 (즉시 피드백 약함). Enter 안 누르고 분석 버튼 직접 클릭하는 경로도 있어 UrlInput 컴포넌트가 trigger를 정확히 발생시켜야 함.

### ADR-025: 명시적 취소 버튼 + 네트워크 자동 감지 + ErrorBoundary
**결정**: 사용자 통제 안전망 3종.
1. 분석 진행 중 "취소" 버튼 (AbortController.abort() → idle).
2. `navigator.onLine` + online/offline 이벤트. offline 시 상단 배너 + 진행 중 분석 abort.
3. React ErrorBoundary로 비예측 JS 에러 catch. **기본 CTA는 "새로고침"** (가장 자주 도움), 이슈 보고는 시각적으로 약한 보조 액션. 에러는 외부 전송 안 함 (BYOK 프라이버시).
**이유**: 사용자가 갇히는 상황 방지. "기다리세요"만 강요하면 탭 닫음. 일반 사용자에게 이슈 보고는 복구 동선 아님.
**트레이드오프**: 코드 복잡도 증가. 모든 services가 signal 받아야 함.

### ADR-026: 페이지 title 동적 + URL hash 인코딩 (분석 시작 직후 갱신)
**결정**: 결과 도착 시 `document.title = "{영상 제목} - 분석 결과"`. **URL hash는 ANALYZE_REQUESTED 직후 갱신** (`history.replaceState`, history 오염 방지). 분석 도중 새로고침에도 hash로 복원 가능. 페이지 첫 진입 시 hash 발견 시 자동 메타 로드 + 캐시 조회.
**이유**: 탭 전환 시 식별 가능. 분석 도중 새로고침해도 사용자 입력을 잃지 않음. 결과 도착 후 갱신이면 진행 중 새로고침에서 URL 컨텍스트가 사라진다.
**트레이드오프**: hashchange 이벤트 처리 + 뒤로가기 동작 정의 필요. BYOK 본질상 공유 받은 사람은 자신의 키로 다시 분석.

### ADR-027: 접근성 — focus trap + aria-live + reduce-motion + 색 외 표현
**결정**:
1. 모달 활성화 시 focus trap + ESC 닫기 + 닫힐 때 트리거로 focus 복귀.
2. `aria-live="polite"` (진행 상태 + `status.analysisComplete`), `aria-live="assertive"` (에러).
3. `prefers-reduced-motion: reduce` 시 fade-in 비활성화 + 모든 transition 끔.
4. sentiment에 색 + 라벨 동시 노출.
5. 차트 `aria-label` + 시각적으로 숨긴 텍스트 대안.

**이유**: WCAG AA를 단순 선언이 아닌 강제 구현 규칙으로 박음.
**트레이드오프**: 컴포넌트별 보일러플레이트 증가.

### ADR-028: 마이크로 카피 SSOT — PRD 카피 표
**결정**: 모든 UI 텍스트는 PRD 카피 표에서 가져온다. `lib/copy.ts`에 객체로 import + `t(key, params)`. 컴포넌트 안에서 임의 문구 작성 금지. aria-live 메시지도 카피 표에 등록 (예: `status.analysisComplete`).
**이유**: 일관성 + 톤 통일 + 향후 i18n 즉시 전환 가능.
**트레이드오프**: 새 문구마다 PRD → copy.ts 두 단계 갱신.

### ADR-029: 분석 신뢰도 면책 + 표본 크기 표시 + 임계 경고 + PII 마스킹
**결정**:
1. 결과 하단 `result.disclaimer` 항상.
2. 결과 헤더에 표본 크기.
3. 댓글 < 10일 때 `result.lowConfidence`.
4. 토큰 truncation 시 `result.truncatedNotice`.
5. summary/strengths/improvements/notableComments 텍스트에서 전화/이메일 정규식 매칭 → `lib/pii.ts`가 마스킹 (`***-****-****` / `***@***`).
**이유**: AI 결과를 무비판적으로 받지 않게 + LLM이 무심코 노출할 수 있는 PII 마스킹.
**트레이드오프**: 마스킹 false positive 가능성 (정상 숫자/주소 패턴 일부 손실).

### ADR-030: 프라이버시 안내 + 데이터 삭제 동선
**결정**:
1. 키 모달과 푸터에 프라이버시 안내 카피 (`footer.privacy`).
2. "모든 데이터 삭제" 버튼 → 확인 → `keys:* + report:* + videometa:* + flag:*` 전부 제거.
3. 키 마스킹 표시.
4. ErrorBoundary catch한 에러 외부 전송 안 함.
**이유**: BYOK 신뢰의 핵심.
**트레이드오프**: 분석/오류 추적 도구 도입 불가 (의도된 제약).

### ADR-031: Anthropic 브라우저 직접 호출 (`dangerouslyAllowBrowser: true`) + step 0 PoC 검증
**결정**: 서버 없는 BYOK 모델 특성상 `@anthropic-ai/sdk`를 브라우저에서 직접 호출한다.
- SDK 초기화 옵션: `{ apiKey, dangerouslyAllowBrowser: true }`.
- step 0의 부트스트랩 PoC에서 실제 호출 1회 시도해 다음을 검증:
  1. SDK가 브라우저에서 로드/동작하는가
  2. CORS 사전 요청이 통과하는가
  3. system content block + `cache_control: ephemeral` 응답이 정상 도착하고 `cache_creation_input_tokens`/`cache_read_input_tokens`가 응답 usage에 보이는가
- PoC 실패 시 step 0를 blocked 처리하고 사용자에게 보고 (CORS 차단/SDK 미지원 등의 경우 BYOK SPA 자체가 성립 안 함).
- 런타임에 CORS/SDK 차단이 감지되면 `ClaudeBrowserUnsupportedError` (`code: AI_BROWSER_UNSUPPORTED`) 도메인 에러로 사용자에 안내 + 브라우저 호환성 안내 카피.

**이유**: BYOK SPA의 핵심 가정. 이 가정이 깨지면 아키텍처 전체 재설계 필요하므로 step 0에서 차단해야 함. `dangerouslyAllowBrowser`는 SDK가 명시적으로 요구하는 옵션 — 키 노출 위험에 대한 SDK의 경고이며, BYOK 모델에서는 키 소유자가 본인이므로 합리적.

**트레이드오프**: 키가 브라우저 메모리에 평문으로 존재하는 위험. localStorage 저장 자체와 동일한 신뢰 가정. 사용자에게 프라이버시 안내(ADR-030)로 투명성 확보.

### ADR-032: Playwright smoke 테스트 — MVP 포함
**결정**: Vitest 단위/컴포넌트 외에 **Playwright e2e smoke 테스트**를 MVP에 포함한다. 최소 시나리오:
1. 키 모달 입력 → 저장 → URL 입력 → 분석 (Anthropic/YouTube 모두 mock fixture) → 결과 카드 렌더.
2. URL hash에 videoId 박은 채로 새로고침 → 메타 미리보기 + 캐시된 결과 복원.
3. 모바일 viewport(375×667)에서 가로 스크롤 없음 + 카드 1열 렌더.
4. 콘솔에 CSP 위반 / 미처리 에러 없음.

**이유**: Safari/iOS/Android 지원이 PRD 비기능 요구인데 실제 브라우저 검증이 없으면 hash 동기화 / CSP / Tailwind 반응형 / focus management가 깨져도 PR 머지될 수 있음. 단위 테스트로는 happy-dom의 미지원 API와 CSP 적용을 검증 못 함.

**트레이드오프**: 추가 의존성(Playwright) + CI 시간 증가. 시나리오를 4개로 한정해 비용 통제.
