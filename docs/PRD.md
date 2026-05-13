# PRD: YouTube Comment Analyzer

## 문제 정의
유튜브 크리에이터는 매 영상마다 수십~수백 개 댓글을 직접 읽어야 시청자 반응을 파악한다. 시간이 많이 들고, 패턴(반복되는 칭찬/불만)을 놓치기 쉽고, 톤(긍정/부정) 분포를 정량적으로 보기 어렵다.

## 목표
유튜브 URL 하나로 댓글 자동 수집·분석해 **30초 이내**에 크리에이터용 피드백 리포트를 보여준다.

## 사용자
- **주 타깃**: 1인 유튜브 크리에이터 (구독자 1천~50만)
- **부 타깃**: 대형 채널 PD/매니저
- **공통**: 영상당 댓글 수십~수백 개. 매번 읽기 부담. 데이터로 개선점을 보고 싶음.

---

## 핵심 기능

### 1. 영상 메타 미리보기
- URL 입력 후 사용자가 **명시적 트리거**(입력 필드 blur 또는 Enter 키)를 발생시켰을 때 `videos.list` 호출로 **제목/채널명/썸네일/총 댓글 수** 표시
- "이 영상 맞나요?" 확인 UX
- 메타 호출 정책 (BYOK 쿼터 보호):
  - 같은 videoId는 재호출 안 함 (videoId de-dupe)
  - 이전 메타 호출이 진행 중이면 abort 후 새 호출
  - 메타 결과는 `videometa:{videoId}` 키로 localStorage에 1시간 TTL 캐시 (분석 결과 캐시와 별도)
- 메타 조회 실패 시:
  - 4xx auth → `meta.metaAuthError` 표시 + 설정 모달 자동 오픈 (분석도 차단)
  - 404 → `YT_NOT_FOUND` 표시 (분석 차단)
  - 5xx / 네트워크 → `meta.metaLoadError` 표시 + 영상 제목은 `[videoId]` fallback + **분석 시작 버튼은 활성화** (사용자가 그래도 분석할 수 있게)

### 2. URL 입력 → videoId 파싱
- 지원 형식: `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID`, `youtube.com/embed/ID`, `youtube.com/v/ID`, `m.youtube.com/*`, `youtube.com/live/ID`
- 부가 파라미터(`?t=`, `?list=`, `&si=`) 무시
- http/https 모두 허용
- 파싱 실패 시 즉시 인라인 에러

### 3. 댓글 수집 (YouTube Data API v3)
- `commentThreads.list`, `part=snippet`, `maxResults=100`, `order=relevance`, `textFormat=plainText`
- **`pageToken`은 사용하지 않는다.** 첫 응답 페이지의 최대 100개 톱-레벨 댓글만 분석한다 (`maxResults=100`은 한 페이지 최대값이며 페이지네이션 없음).
- 각 댓글: `id`, `textOriginal`, `likeCount`, `author`

### 4. AI 분석 (Claude Haiku 4.5)
- 모델: `claude-haiku-4-5-20251001`
- Anthropic SDK 옵션: `dangerouslyAllowBrowser: true` (BYOK 브라우저 호출 — ADR-031 참조)
- system 은 단순 string (분석 지침 그대로). prompt caching 미사용 — ADR-003 (PoC 결과 SYSTEM_PROMPT 가 캐시 임계값 미달).
- 응답은 JSON, zod 검증, 실패 시 1회 재시도
- 출력: 요약 / 감지 언어 / 센티멘트 분포 / 강점 / 개선점 / 키워드 / 주목 댓글

### 5. 결과 대시보드
- 단일 페이지, 좌측 정렬, 카드 6종
- 결과 헤더에 **영상 제목 + 채널 + 분석 시점 + 표본 크기**
- 카드별 fade-in 0.4s (prefers-reduced-motion: reduce 시 비활성화)
- "재분석" 버튼 — 캐시 무시 + 재호출
- 결과 하단에 신뢰도 면책 카피

### 6. 캐싱
- 분석 결과: `report:{videoId}` 키 localStorage. 값: `{ schemaVersion, createdAt, videoMeta, report }`. TTL 30일.
- 영상 메타: `videometa:{videoId}` 키 localStorage. 값: `{ schemaVersion, fetchedAt, videoMeta }`. TTL 1시간.
- 스키마 mismatch / 손상 시 자동 무효화

### 7. 명시적 취소
- 분석 중 "취소" 버튼 노출 → AbortController.abort() → idle 복귀
- 키보드 ESC도 취소 (단 모달 열려있으면 모달이 우선)

### 8. 새로고침 / URL hash 복원
- **"분석 시작" 버튼 클릭 직후** URL hash에 videoId 인코딩 (`#v=dQw4w9WgXcQ`, `history.replaceState`로 history 오염 방지) — 분석 도중 새로고침에도 복원 가능
- 페이지 새로고침 / 직접 링크 진입 시 hash에서 videoId 복원 → 메타 + 캐시 조회 → 히트면 즉시 결과, 미스면 메타 미리보기 화면
- 부산물로 결과 공유 가능 (URL 복사). 공유받은 사람은 본인 키로 다시 분석해야 함.

---

## 사용자 플로우

### A. 첫 진입 (키 미입력)
1. 페이지 로드 → 화면 상단에 환영 카피 `welcome.intro` 1줄 표시 + API 키 모달 자동 노출
2. 모달은 닫기 불가 (ESC, 배경 클릭, X 버튼 모두 무효)
3. 모달 안에 두 키 입력 필드 + 발급 가이드 토글
   - 발급 가이드(접힌 상태): `keys.guideToggleClosed`
   - 펼치면 YouTube/Anthropic 각각 절차 + 외부 링크
4. 키 형식: 빈 문자열만 클라이언트 차단
5. 입력 필드 `type="password"` + "보기" 토글
6. "저장" → localStorage 저장 → 모달 닫힘 + URL 입력 화면
7. 화면 어딘가 항상 표시: "키는 이 브라우저에만 저장됩니다 · [모든 데이터 삭제]"

### B. 기본 플로우 (키 있음)
1. URL 입력 → onChange로 형식 검증만 (API 호출 없음)
2. **사용자가 입력 필드를 blur하거나 Enter를 누르면** videoId 추출 후 `videos.list` 호출 (videoId de-dupe / 진행 중 호출 abort / 1시간 캐시 우선)
3. 메타 도착 → **VideoMetaPreview 카드 표시** (썸네일 + 제목 + 채널 + 댓글 수). 메타 실패면 `meta.metaLoadError` + `[videoId]` fallback 제목, 4xx auth면 `meta.metaAuthError` + 설정 모달, 404면 `YT_NOT_FOUND` + 분석 차단
4. "분석 시작" 클릭 → URL hash 갱신 → 캐시 조회 → 히트면 즉시 렌더, 미스면 진행 화면
5. 진행 화면: 단계 텍스트 + spinner + **취소 버튼** + 예상 시간 카피 `progress.estimate`
6. 결과 도착 → 카드 fade-in + aria-live polite로 `status.analysisComplete`
7. "재분석" / 새 URL 입력으로 반복

### C. 캐시 히트 플로우
- 결과 헤더에 `result.headerCached` (예: "3일 전 분석 · 캐시된 결과 · 댓글 87개 기준") + "재분석" 강조 버튼

### D. 새로고침 / 직접 링크
- URL hash에 videoId → 자동으로 메타 조회 (1시간 캐시 우선) + 분석 결과 캐시 조회 → 결과 표시 또는 메타 미리보기

### E. 키 변경
- 헤더 우측 "설정" 아이콘 → 모달 재오픈
- 키 수정 / 삭제 / 모든 데이터 삭제
- **인증 에러 상태에서 키 저장 시 → error.previous로 자동 복귀** (idle로 떨어뜨리지 않음. 사용자가 입력한 URL/메타 컨텍스트 유지)

### F. 데이터 삭제
- 모달 안에 "모든 데이터 삭제" 버튼 → 확인 다이얼로그 (`keys.deleteConfirmBody`) → 확정 시 **`keys:*` + `report:*` + `videometa:*` + `flag:*` prefix 전부 제거** → needs_keys 상태

### G. 오프라인 / 네트워크 끊김
- `online`/`offline` 이벤트 listen → offline 진입 시 상단 배너 (`OFFLINE`)
- 분석 중 offline 전환 → 진행 중단 + 에러 처리
- online 복귀 시 배너 사라짐. 자동 재시도 없음.

### H. 치명적 JS 에러
- React ErrorBoundary가 잡아서 `boundary.title` + `boundary.body` 표시
- **기본 CTA는 "새로고침" 버튼**. "이슈 보고" 링크는 보조 액션 (시각적으로 약하게)
- 에러는 외부 전송 안 함 (BYOK 프라이버시) — console.error로만 기록

---

## 비기능 요구사항

### 성능
- 캐시 히트 렌더: < 200ms
- 메타 미리보기 (캐시 미스): < 2초
- 분석 전체 (캐시 미스): < 30초 (95p)
- 번들: gzip < 300KB

### 접근성 (WCAG AA)
- 키보드만으로 모든 기능 사용 가능
- focus ring 가시 (`focus-visible:ring-2`)
- 색상 외 라벨/패턴으로 sentiment 구분 (색맹)
- aria-live로 진행/완료/에러 안내
- 모달 focus trap + ESC 닫기 (needs_keys 모달은 ESC 무효)
- 차트는 표/리스트 텍스트 대안 제공
- prefers-reduced-motion: reduce 시 fade-in 비활성화
- 터치 영역 최소 44×44 px

### 브라우저 지원
- Chrome / Edge / Firefox / Safari 최신 2 버전
- iOS Safari, Android Chrome

### 반응형
- 데스크탑(≥ 1024px): max-w-5xl, 카드 2열
- 태블릿(640~1024px): max-w-5xl, 카드 2열 균등
- 모바일(< 640px): 카드 1열, 차트 축소
- 모바일 카드 순서: Summary → SentimentChart → Strengths → Improvements → Keywords → NotableComments
- 가로 스크롤 금지
- iOS 안전 영역 대응 (`env(safe-area-inset-bottom)`)

---

## 마이크로 카피 표 (SSOT)

모든 UI 텍스트는 이 표를 출처로 한다. 컴포넌트가 임의로 만들지 않는다.

### 환영
| key | 텍스트 |
|---|---|
| `welcome.intro` | YouTube 영상 URL을 붙여넣으면 댓글을 자동으로 분석해드립니다. |

### 헤더
| key | 텍스트 |
|---|---|
| `header.title` | YouTube 댓글 분석 |
| `header.settings` | 설정 |
| `header.reanalyze` | 재분석 |

### 상태 안내 (aria-live)
| key | 텍스트 |
|---|---|
| `status.analysisComplete` | 분석이 완료되었습니다 |
| `status.fetchingStarted` | 댓글 수집을 시작합니다 |
| `status.analyzingStarted` | AI 분석을 시작합니다 |
| `status.cancelled` | 분석이 취소되었습니다 |

### API 키 모달
| key | 텍스트 |
|---|---|
| `keys.modalTitle` | API 키를 입력해주세요 |
| `keys.modalIntro` | 분석에 필요한 두 개의 API 키를 입력해주세요. 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다. |
| `keys.youtubeLabel` | YouTube Data API 키 |
| `keys.youtubePlaceholder` | AIza... |
| `keys.anthropicLabel` | Anthropic API 키 |
| `keys.anthropicPlaceholder` | sk-ant-... |
| `keys.showToggle` | 보기 |
| `keys.hideToggle` | 숨기기 |
| `keys.save` | 저장 |
| `keys.guideToggleClosed` | API 키는 어떻게 받나요? |
| `keys.guideToggleOpen` | 가이드 닫기 |
| `keys.youtubeGuide` | Google Cloud Console에 접속 → 새 프로젝트 생성 → "APIs & Services > Library"에서 YouTube Data API v3 검색 후 활성화 → "Credentials > Create credentials > API key" 클릭 → 생성된 키 복사. |
| `keys.anthropicGuide` | Anthropic Console에 접속 → 계정 생성 후 결제 수단 등록 → "API Keys > Create Key" 클릭 → 생성된 키 복사. (사용량에 따라 과금됩니다) |
| `keys.youtubeGuideLink` | Google Cloud Console 열기 |
| `keys.anthropicGuideLink` | Anthropic Console 열기 |
| `keys.deleteAll` | 모든 데이터 삭제 |
| `keys.deleteConfirmTitle` | 모든 데이터를 삭제할까요? |
| `keys.deleteConfirmBody` | 입력한 API 키와 저장된 모든 분석 결과·메타 캐시가 삭제됩니다. 되돌릴 수 없습니다. |
| `keys.deleteConfirmAction` | 삭제 |
| `keys.deleteCancel` | 취소 |

### URL 입력
| key | 텍스트 |
|---|---|
| `url.label` | YouTube 영상 URL |
| `url.placeholder` | https://www.youtube.com/watch?v=... |
| `url.submit` | 분석 시작 |
| `url.errorInvalidDomain` | YouTube URL이 아닙니다 |
| `url.errorInvalidVideo` | 올바른 영상 URL이 아닙니다 |
| `url.errorPlaylist` | 영상 URL만 지원합니다 (플레이리스트 불가) |
| `url.errorChannel` | 영상 URL만 지원합니다 |

### 영상 메타 미리보기
| key | 텍스트 |
|---|---|
| `meta.previewTitle` | 분석할 영상 |
| `meta.channelLabel` | 채널 |
| `meta.commentCountLabel` | 댓글 |
| `meta.commentCountFormat` | {count}개 |
| `meta.metaLoadError` | 영상 정보를 불러올 수 없습니다. 그래도 분석을 진행할 수 있습니다. |
| `meta.metaAuthError` | API 키 인증에 실패했습니다. 설정에서 키를 다시 확인해주세요. |

### 진행 표시
| key | 텍스트 |
|---|---|
| `progress.fetching` | 댓글을 모으고 있어요… |
| `progress.analyzing` | AI가 댓글을 분석하고 있어요… |
| `progress.estimate` | 보통 20~30초 정도 걸립니다 |
| `progress.cancel` | 취소 |

### 결과 헤더
| key | 텍스트 |
|---|---|
| `result.headerJustNow` | 방금 분석 · 댓글 {count}개 기준 |
| `result.headerCached` | {relativeTime} 분석 · 캐시된 결과 · 댓글 {count}개 기준 |
| `result.openVideo` | 영상 열기 |
| `result.disclaimer` | AI가 자동으로 분석한 결과입니다. 100% 정확하지 않을 수 있으며 참고용으로 활용해주세요. |
| `result.lowConfidence` | 댓글 표본이 적어({count}개) 분석 신뢰도가 낮을 수 있습니다 |
| `result.truncatedNotice` | 토큰 한도로 좋아요 상위 {count}개 댓글만 분석했습니다 |
| `result.languageLabel` | 감지된 언어 |

### 카드 제목
| key | 텍스트 |
|---|---|
| `card.summary` | 요약 |
| `card.sentiment` | 감정 분포 |
| `card.strengths` | 잘하고 있는 점 |
| `card.improvements` | 개선할 점 |
| `card.keywords` | 자주 등장한 키워드 |
| `card.notableComments` | 주목할 만한 댓글 |

### 차트 라벨
| key | 텍스트 |
|---|---|
| `sentiment.positive` | 긍정 |
| `sentiment.neutral` | 중립 |
| `sentiment.negative` | 부정 |

### 카드 빈 상태 / 인터랙션
| key | 텍스트 |
|---|---|
| `card.emptyStrengths` | 뚜렷한 강점 패턴이 발견되지 않았습니다 |
| `card.emptyImprovements` | 뚜렷한 개선 요구 패턴이 발견되지 않았습니다 |
| `card.emptyKeywords` | 반복되는 키워드가 충분하지 않습니다 |
| `card.emptyNotable` | 좋아요가 있는 주목할 댓글이 없습니다 |
| `card.evidenceLabel` | 근거 댓글 |
| `card.evidenceMore` | 더 보기 |
| `card.evidenceLess` | 접기 |
| `card.likesFormat` | 좋아요 {count}개 |

### 빈 상태 (분석 결과 없음)
| key | 텍스트 |
|---|---|
| `empty.commentsDisabledTitle` | 댓글이 비활성화된 영상입니다 |
| `empty.commentsDisabledBody` | 이 영상은 댓글이 꺼져 있어 분석할 수 없습니다. 다른 영상으로 시도해보세요. |
| `empty.noCommentsTitle` | 분석할 댓글이 없습니다 |
| `empty.noCommentsBody` | 이 영상에는 아직 댓글이 없습니다. 댓글이 쌓인 후 다시 시도해주세요. |

### 에러 메시지 (도메인 에러 code → userMessage)
| code | userMessage |
|---|---|
| `INVALID_URL` | 올바른 YouTube 영상 URL이 아닙니다. 다시 확인해주세요. |
| `YT_AUTH` | YouTube API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요. |
| `YT_QUOTA` | 오늘 YouTube API 사용량 한도를 초과했습니다. 내일 다시 시도하거나 다른 키를 사용해주세요. |
| `YT_NOT_FOUND` | 영상을 찾을 수 없습니다. URL을 다시 확인해주세요. |
| `YT_BAD_REQUEST` | 영상 정보를 가져올 수 없습니다. URL을 다시 확인해주세요. |
| `YT_SERVER` | YouTube 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요. |
| `AI_AUTH` | Anthropic API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요. |
| `AI_RATE_LIMIT` | AI 분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. |
| `AI_SERVER` | AI 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요. |
| `AI_SCHEMA` | AI 응답 형식 오류가 반복되어 분석을 완료하지 못했습니다. 다시 시도해주세요. |
| `AI_MAX_TOKENS` | AI 응답이 잘려서 도착했습니다. 다시 시도하거나, 댓글이 더 적은 다른 영상으로 시도해주세요. |
| `AI_BROWSER_UNSUPPORTED` | 이 브라우저 환경에서 AI 호출이 차단되었습니다. 최신 Chrome/Edge/Firefox/Safari에서 다시 시도해주세요. |
| `NETWORK` | 네트워크 연결을 확인해주세요. |
| `OFFLINE` | 오프라인입니다. 네트워크 연결을 확인해주세요. |
| `STORAGE` | 브라우저 저장 공간이 부족합니다. 캐시 일부가 저장되지 않을 수 있습니다. |
| `UNKNOWN` | 예기치 못한 오류가 발생했습니다. 다시 시도해주세요. |

### 에러 배너 액션
| key | 텍스트 |
|---|---|
| `error.retry` | 다시 시도 |
| `error.editUrl` | URL 수정 |
| `error.openSettings` | 설정 열기 |
| `error.refreshPage` | 새로고침 |

### Toast
| key | 텍스트 |
|---|---|
| `toast.storageFallback` | 이 브라우저 모드에서는 키와 캐시가 세션 종료 시 사라집니다 |
| `toast.cacheSaveFailed` | 분석 결과를 저장하지 못했지만 화면에는 표시됩니다 |
| `toast.copied` | 복사되었습니다 |

### 푸터
| key | 텍스트 |
|---|---|
| `footer.disclaimer` | 이 도구는 YouTube와 Anthropic의 공식 제품이 아닙니다. |
| `footer.privacy` | 입력한 API 키와 댓글 데이터는 이 브라우저를 떠나 YouTube/Anthropic API 외 다른 서버로 전송되지 않습니다. |
| `footer.source` | 소스 코드 |

### React ErrorBoundary
| key | 텍스트 |
|---|---|
| `boundary.title` | 예기치 못한 오류가 발생했습니다 |
| `boundary.body` | 새로고침으로 복구해주세요. |
| `boundary.refresh` | 새로고침 |
| `boundary.reportSecondary` | 같은 오류가 반복되면 이슈를 남겨주세요 |

### 페이지 메타
| key | 텍스트 |
|---|---|
| `meta.titleDefault` | YouTube 댓글 분석 |
| `meta.titleAnalyzing` | 분석 중… - YouTube 댓글 분석 |
| `meta.titleResult` | {videoTitle} - 분석 결과 |
| `meta.description` | YouTube 영상의 댓글을 자동으로 분석해 크리에이터를 위한 피드백 리포트를 제공합니다. |

### 상대 시간
| key | 텍스트 |
|---|---|
| `relTime.justNow` | 방금 |
| `relTime.minutesAgo` | {n}분 전 |
| `relTime.hoursAgo` | {n}시간 전 |
| `relTime.daysAgo` | {n}일 전 |
| `relTime.weeksAgo` | {n}주 전 |
| `relTime.over30Days` | 30일 이상 전 |

---

## 에러 & 엣지 케이스

### URL 입력
| 케이스 | 처리 |
|---|---|
| 빈 입력 | "분석 시작" disabled, 에러 없음 |
| 공백/줄바꿈 포함 | trim 후 재검증 |
| 도메인 불일치 | `url.errorInvalidDomain` |
| videoId 추출 실패 | `url.errorInvalidVideo` |
| 플레이리스트 URL | `url.errorPlaylist` |
| 채널 URL | `url.errorChannel` |
| 매우 긴 URL (>2000자) | 거부, `url.errorInvalidVideo` |

### YouTube `videos.list` (메타 미리보기)
| 케이스 | 처리 |
|---|---|
| 200 + items 있음 | VideoMetaPreview 렌더 + 1시간 캐시 저장 |
| 200 + items 빈 배열 | `YT_NOT_FOUND` (영상 존재 안 함. 분석 차단) |
| 4xx auth | `meta.metaAuthError` + 설정 모달 자동 오픈 (분석 차단) |
| 404 | `YT_NOT_FOUND` (분석 차단) |
| 5xx / 네트워크 | `meta.metaLoadError` (silent) + 분석은 진행 가능 (`[videoId]` fallback 제목) |
| AbortError | UI 갱신 안 함 (의도된 취소) |

### YouTube `commentThreads.list` (분석)
| HTTP / 케이스 | 처리 |
|---|---|
| 401/403 invalid_key | `YT_AUTH` + 설정 모달 자동 오픈 |
| 403 quotaExceeded | `YT_QUOTA` |
| 403 commentsDisabled | EmptyState `commentsDisabled` |
| 404 videoNotFound | `YT_NOT_FOUND` |
| 400 invalidArgument | `YT_BAD_REQUEST` |
| 5xx | 1회 재시도 (1초), 실패 시 `YT_SERVER` |
| 네트워크 끊김 | `NETWORK` |
| 댓글 0개 | EmptyState `noComments` |
| 댓글 1~9개 | 정상 분석 + `result.lowConfidence` 표시 |
| 댓글 10~99개 | 정상 분석 + "댓글 N개 기준" |

### Anthropic API
| HTTP / 케이스 | 처리 |
|---|---|
| 브라우저 호출 차단 (CORS / SDK 미지원) | `AI_BROWSER_UNSUPPORTED` (사용자에게 브라우저 안내) |
| 401 | `AI_AUTH` + 설정 모달 자동 오픈 |
| 400 | 토큰 한도면 truncation 경로. 그 외 실패 시 `AI_SCHEMA` |
| 429 | 백오프 2회 재시도, 실패 시 `AI_RATE_LIMIT` |
| 5xx/529 | 백오프 2회 재시도, 실패 시 `AI_SERVER` |
| JSON 파싱 실패 | 1회 재시도, 실패 시 `AI_SCHEMA` |
| zod 검증 실패 (sentiment 합 ≠ 100 등) | 1회 재시도, 실패 시 `AI_SCHEMA` |
| evidence가 입력 댓글에 없음 (hallucinated) | services 후처리로 evidence 필터링 (입력 댓글에 존재 검사). 0건 남으면 해당 strength/improvement 항목 제거 |
| 토큰 한도 초과 | likeCount 상위 50개로 자르고 1회 재시도. 결과에 `result.truncatedNotice` |
| stop_reason: max_tokens | `AI_MAX_TOKENS` |
| 네트워크 끊김 | `NETWORK` |

### 데이터 임계 케이스 (결과 표시)
| 케이스 | 처리 |
|---|---|
| sentiment 한쪽 100% | 차트 그대로. 카드 본문 LLM 출력 그대로. |
| sentiment 합 ≠ 100 | zod 검증 실패로 재시도 경로 |
| strengths 0개 | `card.emptyStrengths` |
| improvements 0개 | `card.emptyImprovements` |
| keywords 0개 | `card.emptyKeywords` |
| notableComments 0개 | `card.emptyNotable` |
| 댓글 표본 < 10 | `result.lowConfidence` 노출 |
| 응답에 PII 포함 (전화/이메일 정규식 매칭) | services에서 마스킹 (`***-****-****`) 후 표시 |

### localStorage
| 케이스 | 처리 |
|---|---|
| QuotaExceededError | 가장 오래된 `report:*` 항목 1개 제거 후 재시도, 또 실패면 `toast.cacheSaveFailed` |
| SecurityError (Safari private) | 인메모리 fallback, `toast.storageFallback` 1회 |
| 스키마 불일치 / JSON 손상 | 항목 삭제 후 miss |
| TTL 만료 (report 30일 / videometa 1시간) | 항목 삭제 후 miss |

### 동시성
| 케이스 | 처리 |
|---|---|
| 분석 시작 연타 | 진행 중 controller.abort() 후 새 요청. 버튼 disabled |
| 분석 중 URL 변경 | 진행 중 cancel |
| 분석 중 "취소" 클릭 | controller.abort() → idle 복귀 (AbortError 사용자 표시 안 함) |
| 메타 호출 중 URL 변경 | 이전 메타 호출 abort + 새 요청 (단 같은 videoId면 abort 없이 진행) |
| 새로고침 (분석 중) | 진행 중 분석 손실. hash로 메타 미리보기 복원 |
| 백그라운드 탭 | 영향 없음 |
| online → offline (분석 중) | `OFFLINE` 에러 + 상단 배너 |
| offline → online | 배너 사라짐. 자동 재시도 안 함 |
| 인증 에러 후 키 갱신 | error.previous로 복귀 (idle 아님) — 사용자 컨텍스트 유지 |

### 보안/프라이버시
- API 키 입력 필드: `autocomplete="off"` + `type="password"`
- 키 화면 표시는 마스킹 (`••••••••a8k2`)
- 댓글 본문 React 기본 escape에 의존
- 외부 링크 `rel="noopener noreferrer"`
- 응답 PII 자동 마스킹 (services 후처리)

---

## MVP 제외 사항
- 로그인 / 계정 / 사용자 관리
- 서버 / 백엔드 / DB
- 답글(reply) 분석
- 다중 영상 비교 / 채널 단위 집계
- 분석 결과 PDF/이미지 내보내기
- 알림 / 정기 분석
- 결제 / 사용량 미터링
- 다국어 UI (UI 한국어 고정. 분석 결과만 다국어)
- 댓글 페이지네이션 (100개 초과 — `pageToken` 사용 안 함)
- 사용자 정의 프롬프트
- 분석 이력 페이지
- 결과 카드의 evidence 댓글에서 YouTube 원본 댓글로 deep-link

---

## 디자인
- 다크모드 고정, 미니멀 (UI_GUIDE.md)
- 무채색 + 시맨틱 컬러 (긍정 #22c55e / 부정 #ef4444 / 중립 #525252)
- "도구처럼 보여야 한다"

## 성공 지표 (참고)
- 첫 분석 < 30초 (95p)
- 캐시 히트 < 1초
- 에러 발생 시 사용자가 다음 행동을 100% 알 수 있는 메시지
- 한 세션 영상 3개 연속 분석 (가설)
