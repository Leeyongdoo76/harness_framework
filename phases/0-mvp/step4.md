# Step 4: service-youtube

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — services/youtube 섹션, 데이터 흐름, 에러 매핑
- `/docs/PRD.md` — 에러 카피 표 (code 매핑 검증용), 엣지 케이스 표
- `/docs/ADR.md` — ADR-004 (commentThreads, pageToken 미사용), ADR-008 (도메인 에러), ADR-009 (재시도), ADR-013 (boundary 변환), ADR-020 (textOriginal), ADR-024 (videos.list)

step 1 산출물:
- `src/types/errors.ts`, `src/types/youtube.ts`, `src/types/videoMeta.ts`

step 2 산출물:
- `src/lib/retry.ts`

## 작업

`src/services/youtube.ts`에 YouTube Data API 호출을 캡슐화한다. **모든 외부 에러를 도메인 에러로 변환** (ADR-013).

### 시그니처

```ts
import type { VideoMeta } from "@/types/videoMeta";
import type { Comment } from "@/types/youtube";

export async function fetchVideoMeta(
  videoId: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<VideoMeta>;

export async function fetchTopComments(
  videoId: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<Comment[]>;
```

### `fetchVideoMeta` 규칙

URL: `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id={videoId}&key={apiKey}`

응답 분기:
| 케이스 | 처리 |
|---|---|
| 200 + items 1개 이상 | `VideoMeta` 반환 |
| 200 + items 빈 배열 | `YouTubeNotFoundError` throw |
| 401 OR 403 (reason: keyInvalid/forbidden) | `YouTubeAuthError` |
| 403 reason: quotaExceeded | `YouTubeQuotaError` |
| 404 | `YouTubeNotFoundError` |
| 400 | `YouTubeBadRequestError` |
| 5xx | `YouTubeServerError` |
| fetch reject (TypeError 등) | `NetworkError` |
| AbortError | 그대로 re-throw |

**재시도 없음** (ADR-024). 5xx/네트워크도 throw — UI silent 처리는 호출자(App)가.

VideoMeta 매핑:
- `videoId`: 인자
- `title`: `items[0].snippet.title`
- `channelTitle`: `items[0].snippet.channelTitle`
- `thumbnailUrl`: `items[0].snippet.thumbnails.medium?.url ?? items[0].snippet.thumbnails.default?.url ?? ""`
- `commentCount`: `items[0].statistics.commentCount`가 있으면 `Number.parseInt(...)`, 없으면 undefined

### `fetchTopComments` 규칙

URL: `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=100&order=relevance&textFormat=plainText&videoId={videoId}&key={apiKey}`

**`pageToken` 절대 사용 금지** (ADR-004).

응답 분기:
| 케이스 | 처리 |
|---|---|
| 200 + items 있음 | `Comment[]` 반환 (최대 100개, API 보장) |
| 200 + items 빈 배열 또는 누락 | `[]` 반환 (호출자가 empty 처리) |
| 401 OR 403 invalid_key | `YouTubeAuthError` |
| 403 quotaExceeded | `YouTubeQuotaError` |
| 403 commentsDisabled | `CommentsDisabledError` |
| 404 videoNotFound | `YouTubeNotFoundError` |
| 400 | `YouTubeBadRequestError` |
| 5xx | retry 1회 (백오프 1초), 실패 시 `YouTubeServerError` |
| Network reject | retry 1회, 실패 시 `NetworkError` |
| AbortError | 그대로 re-throw |

`lib/retry.ts` 사용. `maxAttempts: 2`, `baseDelayMs: 1000`, `shouldRetry`는 `YouTubeServerError | NetworkError` 인스턴스.

Comment 매핑 (ADR-020):
- `id`: `items[i].id`
- `text`: `items[i].snippet.topLevelComment.snippet.textOriginal`
- `likeCount`: `items[i].snippet.topLevelComment.snippet.likeCount`
- `author`: `items[i].snippet.topLevelComment.snippet.authorDisplayName ?? "익명"`

### 에러 응답 파싱 헬퍼

YouTube 4xx:
```json
{ "error": { "code": 403, "errors": [{ "reason": "quotaExceeded" }], "message": "..." } }
```

`error.errors[0].reason`을 기반으로 분기. `reason` 없거나 미지정 reason이면 status code로 fallback.

### 테스트

`fetch` mock (`vi.spyOn(globalThis, "fetch")` 또는 MSW)으로:
- **videos.list**: 200 success, 200 empty items, 401, 403 keyInvalid, 403 quotaExceeded, 404, 400, 500, network reject
- **commentThreads**: 200 success(100개), 200 empty, 403 commentsDisabled, 5xx 재시도 후 성공, 5xx 재시도 후 실패, AbortSignal abort

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크리스트:
   - [ ] `src/services/youtube.ts` 1개 파일 + 테스트
   - [ ] `pageToken` 문자열이 코드에 없음
   - [ ] 모든 4xx/5xx가 도메인 에러로 변환 (raw Error throw 0건)
   - [ ] `signal`이 모든 fetch 호출에 전달
   - [ ] `textOriginal` 사용 (`textDisplay`는 코드에 없음)
   - [ ] 컴포넌트/lib 파일 변경 없음
3. index.json 업데이트:
   - 성공 → `"summary": "services/youtube.ts: fetchVideoMeta + fetchTopComments. 모든 status code → 도메인 에러. pageToken 미사용. textOriginal 사용. AbortSignal 지원."`

## 금지사항

- **`pageToken` 사용 금지.** 100개만. 이유: ADR-004.
- **`textDisplay` 사용 금지.** `textOriginal`만. 이유: ADR-020.
- **raw `Error`/HTTP status code를 throw 금지.** 모두 도메인 에러로. 이유: ADR-013.
- **사용자 입력 URL을 fetch에 직접 넣지 마라.** videoId만 추출해 API URL 템플릿화. 이유: 보안.
- **`fetchVideoMeta`에 재시도 추가 금지.** 메타는 silent fail. 이유: ADR-024.
- **재시도 attempts 임의 변경 금지** (commentThreads는 2회). 이유: ADR-009.
