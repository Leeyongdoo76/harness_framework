# Step 5: service-claude

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — services/claude 섹션 (SDK 초기화, 호출 형식, system 프롬프트, 응답 처리)
- `/docs/PRD.md` — 에러 카피 표(AI_*), 결과 임계 케이스
- `/docs/ADR.md` — ADR-003 (system string, cache_control 폐기), ADR-006 (zod), ADR-010 (truncation + evidence 필터), ADR-019 (no streaming), ADR-029 (PII), ADR-031 (dangerouslyAllowBrowser)

step 1 산출물:
- `src/types/report.ts`, `src/types/errors.ts`, `src/types/youtube.ts` (Comment)

step 2 산출물:
- `src/lib/pii.ts`, `src/lib/retry.ts`

## 사전 조건 — PoC 검증

**이 step 시작 전 step 0의 PoC가 성공한 상태여야 한다.** `phases/0-mvp/index.json`의 step 0 `summary`에 다음이 기록되어 있어야 한다:
- `dangerouslyAllowBrowser` 옵션 동작 확인
- `dangerouslyAllowBrowser: true` 옵션이 SDK 에 받아들여지고 200 OK 응답이 도착하는지 확인. **캐시 가정은 ADR-003 에서 폐기됐으므로 `cache_read_input_tokens` 가 0 이어도 정상**. PoC 결과 SDK + 호출 형식은 검증됨 — 우리 SYSTEM_PROMPT (604 tokens) 가 캐시 임계값(2048+) 미달이라 cache 미적용. summary 에 PoC 결과가 기록돼 있는지만 확인.

PoC 결과가 summary에 없으면 **이 step을 blocked 처리**하고 `blocked_reason: "step 0의 Anthropic PoC 결과가 summary에 없음. PoC 수동 실행 후 재실행 필요."` 기록.

## 작업

`src/services/claude.ts`에 Anthropic SDK 호출 + 프롬프트 + zod + 후처리(evidence 필터 + PII)를 캡슐화한다.

### 시그니처

```ts
import type { Comment } from "@/types/youtube";
import type { Report } from "@/types/report";

export type AnalysisResult = Report & { truncatedCount?: number };

export async function analyzeComments(
  comments: Comment[],
  apiKey: string,
  signal?: AbortSignal
): Promise<AnalysisResult>;
```

### SDK 초기화

```ts
import Anthropic from "@anthropic-ai/sdk";

function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}
```

### System 프롬프트

`SYSTEM_PROMPT` **모듈 레벨 상수**로 정의. 본문은 ARCHITECTURE.md "System 프롬프트" 섹션 그대로. (캐시 가정은 ADR-003 에서 폐기 — cache_control 부착 금지)

### 호출 형식

```ts
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 4096,
  system: SYSTEM_PROMPT,  // string. ADR-003 — cache_control 미사용
  messages: [
    {
      role: "user",
      content: JSON.stringify({
        comments: comments.map(({ id, text, likeCount, author }) => ({ id, text, likeCount, author })),
      }),
    },
  ],
}, { signal });
```

### 응답 처리 순서

1. `response.stop_reason === "max_tokens"` → `ClaudeMaxTokensError` throw (재시도 안 함)
2. `response.content[0]`이 text 타입 아니면 → `ClaudeSchemaError`
3. `JSON.parse(text)` → 실패 시 스키마 재시도 분기
4. `ReportSchema.parse(parsed)` → 실패 시 스키마 재시도 분기
5. **evidence hallucination 필터** (ADR-010): 각 `strength.evidence[i]` / `improvement.evidence[i]`에 대해 입력 `comments[i].text` 중 어느 하나에 substring 일치 여부 검사. 일치 안 하면 제거. evidence 빈 배열이면 해당 strength/improvement 자체 제거.
6. **PII 마스킹** (ADR-029): `maskPIIInReport(report)` 호출
7. 결과 반환

### 스키마 재시도 (1회)

JSON.parse 실패 OR zod 실패 → 응답을 system에 첨부해 1회 재시도:

```ts
// 재시도 시에는 system 에 위반 정보를 추가해야 하므로 content block 배열 사용 (단 cache_control 없음 — ADR-003)
const retrySystem = [
  { type: "text" as const, text: SYSTEM_PROMPT },
  { type: "text" as const, text: `이전 응답이 스키마와 일치하지 않았습니다.\n응답: ${rawResponseText}\n위반: ${zodErrorJson}\n반드시 위 스키마를 따르는 JSON object만 반환하세요.` },
];
```

재시도 실패 시 `ClaudeSchemaError`.

### 토큰 한도 truncation (ADR-010)

400 with `error.type === "invalid_request_error"` AND `error.message`가 "tokens" 포함:

```ts
const truncated = [...comments].sort((a, b) => b.likeCount - a.likeCount).slice(0, 50);
// 같은 분석을 truncated로 1회 재시도
```

재시도 결과에 `truncatedCount: comments.length - truncated.length` 부착. 또 실패면 `ClaudeTokenLimitError`.

### Anthropic SDK 에러 매핑

| SDK 에러 | 도메인 에러 |
|---|---|
| 401 | `ClaudeAuthError` |
| 400 + "tokens" | truncation 경로 |
| 400 그 외 | `ClaudeSchemaError` |
| 429 | `ClaudeRateLimitError` (retry 후) |
| 5xx / 529 | `ClaudeServerError` (retry 후) |
| TypeError (CORS / SDK 차단) | `ClaudeBrowserUnsupportedError` |
| 그 외 Network | `NetworkError` |
| AbortError | re-throw 그대로 |

### 일반 호출 흐름

```ts
async function analyzeComments(comments, apiKey, signal) {
  const client = makeClient(apiKey);
  try {
    return await withRetry(
      () => callOnce(client, comments, signal),
      { maxAttempts: 3, baseDelayMs: 1000, shouldRetry: isRetriableClaudeError, signal }
    );
  } catch (e) {
    throw mapToClaudeError(e);
  }
}
```

`isRetriableClaudeError`: `e instanceof ClaudeRateLimitError || e instanceof ClaudeServerError || e instanceof NetworkError`.

### 테스트 fixture 5종 (ADR-032)

`src/services/claude.test.ts`에 SDK mock:

```ts
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() }
  }))
}));
```

fixture:
1. **비-JSON 응답**: "이건 JSON이 아닙니다." → 1회 재시도 → 또 비-JSON → `ClaudeSchemaError`
2. **sentiment 합 ≠ 100**: `{ positive: 50, neutral: 30, negative: 30 }` → 재시도 → 정상 → 통과
3. **hallucinated evidence**: 입력에 없는 evidence → 제거 검증
4. **PII 포함**: summary에 전화번호 → 마스킹 검증
5. **stop_reason: max_tokens**: 즉시 `ClaudeMaxTokensError`

추가: 토큰 400 → top-50 재시도 → 성공 시 `truncatedCount` 부착.

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/services/claude.ts` 1개 파일 + 테스트
   - [ ] SDK 옵션에 `dangerouslyAllowBrowser: true`
   - [ ] system 이 단순 string (`system: SYSTEM_PROMPT`). cache_control 부착 0건 (ADR-003)
   - [ ] streaming API 미사용 (`client.messages.stream` 0건)
   - [ ] evidence hallucination 필터 (fixture 3 통과)
   - [ ] PII 마스킹 (fixture 4 통과)
   - [ ] 모든 에러 도메인 에러 변환
   - [ ] AbortSignal이 SDK 호출에 전달
3. index.json 업데이트:
   - 성공 → `"summary": "services/claude.ts: Haiku 4.5 + dangerouslyAllowBrowser + system string (cache_control 폐기, ADR-003). zod + 1회 스키마 재시도 + truncation + evidence 필터 + PII 마스킹. fixture 5종 PASS."`
   - PoC 미검증 → `"status": "blocked"`, `"blocked_reason": "step 0의 Anthropic PoC 결과가 summary에 없음. PoC 수동 실행 후 재실행 필요."`

## 금지사항

- **streaming API 사용 금지** (`client.messages.stream`). 이유: ADR-019.
- **임의로 `cache_control` 부착 금지** (system, content block 어디든). 이유: ADR-003 — PoC 결과 우리 SYSTEM_PROMPT 가 캐시 임계값 미달이라 부착해도 캐시 동작 안 함, 코드 노이즈만 늘림.
- **`dangerouslyAllowBrowser` 옵션 제거 금지.** 이유: ADR-031.
- **evidence를 LLM 출력 그대로 신뢰 금지.** substring 일치 검사 필수. 이유: ADR-010.
- **PII 마스킹을 keyword/author에 적용 금지.** 텍스트 필드만. 이유: 입력 그대로의 정보.
- **재시도 정책 임의 변경 금지** (스키마 1회, 일반 3 attempts). 이유: ADR-009.
