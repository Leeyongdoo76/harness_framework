# Step 11: verification

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/PRD.md` — 성공 시나리오, 비기능 요구, 모든 플로우
- `/docs/ARCHITECTURE.md` — 테스트 전략
- `/docs/ADR.md` — ADR-032 (Playwright smoke), ADR-018 (CSP)

step 10 산출물:
- `src/` 전체 (앱 완성)
- `index.html` (CSP 메타 포함)

step 0 산출물:
- `playwright.config.ts`

## 작업

Playwright e2e smoke 4개 + 수동 검증 체크리스트.

### Playwright 시나리오 4개

모든 시나리오는 `page.route(...)`로 외부 API mock. **실제 API 호출 금지**.

#### 1. `tests/e2e/smoke.spec.ts` — 기본 분석 흐름

```
1. page.goto("/")
2. API 키 모달 노출 확인 (locator "API 키" 등)
3. YouTube 키 입력, Anthropic 키 입력 → "저장" 클릭
4. URL 입력 (예: "https://www.youtube.com/watch?v=dQw4w9WgXcQ") → blur
5. page.route("**/youtube.googleapis.com/youtube/v3/videos**") → fixture/youtube-meta.json
6. VideoMetaPreview 노출 확인 (영상 제목 검증)
7. "분석 시작" 클릭
8. page.route("**/youtube.googleapis.com/youtube/v3/commentThreads**") → fixture/youtube-comments.json
9. page.route("**/api.anthropic.com/v1/messages**") → fixture/claude-report.json
10. ProgressIndicator → Dashboard 전이 확인 (waitFor)
11. 6개 카드 모두 렌더 확인 (locator by role/text)
12. 면책 카피 노출 확인 (`result.disclaimer`)
```

#### 2. `tests/e2e/hash-restore.spec.ts` — URL hash 새로고침 복원

```
1. (smoke 동일) 키 입력 → 분석 → 결과 표시
2. expect(page.url()).toMatch(/#v=[A-Za-z0-9_-]{11}/)
3. page.reload()
4. (Anthropic mock 안 함 — 캐시 hit 검증)
   page.route("**/youtube.googleapis.com/youtube/v3/videos**", fixture)
5. 결과 표시 확인 (캐시 히트면 즉시) — `result.headerCached` 카피 노출
```

#### 3. `tests/e2e/mobile-viewport.spec.ts` — 모바일 반응형

```
1. page.setViewportSize({ width: 375, height: 667 })
2. (smoke 동일) 키 입력 → 분석 → 결과
3. 가로 스크롤 없음 검증:
   const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
   expect(hasOverflow).toBe(false);
4. 카드 1열 검증:
   const cards = await page.locator("article, .card").all();
   for (const card of cards) {
     const box = await card.boundingBox();
     expect(box?.width).toBeGreaterThan(300);  // 부모 너비에 가깝게
   }
```

#### 4. `tests/e2e/csp-console.spec.ts` — 콘솔 청결성

```
1. const messages: string[] = [];
   page.on("console", (msg) => { if (msg.type() === "error") messages.push(msg.text()); });
   page.on("pageerror", (err) => messages.push(err.message));
2. (smoke 동일) 키 입력 → 분석 → 결과
3. expect(messages.filter(m => /Content Security Policy/i.test(m))).toEqual([]);
4. expect(messages.filter(m => !/^ErrorBoundary caught/.test(m))).toEqual([]);
   // ErrorBoundary의 의도된 로그는 허용
```

### fixture 파일들

`tests/fixtures/`:
- `youtube-meta.json` — videos.list 응답
- `youtube-comments.json` — commentThreads.list 응답 (50개 댓글)
- `claude-report.json` — Anthropic SDK 응답 (정확한 구조 따라야 함)

**`youtube-meta.json` 예시**:
```json
{
  "items": [{
    "id": "dQw4w9WgXcQ",
    "snippet": {
      "title": "테스트 영상 제목",
      "channelTitle": "테스트 채널",
      "thumbnails": {
        "default": { "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg" },
        "medium": { "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg" }
      }
    },
    "statistics": { "commentCount": "1234" }
  }]
}
```

**`youtube-comments.json` 예시** (commentThreads.list 응답):
```json
{
  "items": [
    {
      "id": "Ugx1",
      "snippet": {
        "topLevelComment": {
          "snippet": {
            "textOriginal": "편집 진짜 깔끔하네요",
            "authorDisplayName": "user1",
            "likeCount": 42
          }
        }
      }
    },
    {
      "id": "Ugx2",
      "snippet": {
        "topLevelComment": {
          "snippet": {
            "textOriginal": "다음 영상도 기대됩니다",
            "authorDisplayName": "user2",
            "likeCount": 17
          }
        }
      }
    }
  ]
}
```

**`claude-report.json` 예시** (Anthropic SDK Messages API 응답 구조 정확히 따름):
```json
{
  "id": "msg_test_01abc",
  "type": "message",
  "role": "assistant",
  "model": "claude-haiku-4-5-20251001",
  "content": [
    {
      "type": "text",
      "text": "{\"summary\":\"전반적으로 긍정적인 반응이 많습니다.\",\"detectedLanguage\":\"ko\",\"sentiment\":{\"positive\":78,\"neutral\":15,\"negative\":7},\"strengths\":[{\"point\":\"편집이 깔끔하다\",\"evidence\":[\"편집 진짜 깔끔하네요\"]}],\"improvements\":[],\"keywords\":[{\"term\":\"편집\",\"count\":12,\"sentiment\":\"pos\"}],\"notableComments\":[{\"text\":\"편집 진짜 깔끔하네요\",\"likes\":42,\"author\":\"user1\"}]}"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 1000,
    "output_tokens": 500,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0
  }
}
```

`content[0].text`의 inner JSON은 `ReportSchema` parse를 통과해야 함 (sentiment 합 100, evidence 입력 댓글에 존재 등).

### `phases/0-mvp/verification-report.md` — 수동 체크리스트 템플릿

다음 내용으로 파일 생성. 사용자가 직접 실행 후 체크:

```markdown
# Verification Report — 0-mvp

작성일: ____
실행자: ____

## 자동 (Playwright smoke 4종)

- [ ] `npx playwright test tests/e2e/smoke.spec.ts` PASS
- [ ] `npx playwright test tests/e2e/hash-restore.spec.ts` PASS
- [ ] `npx playwright test tests/e2e/mobile-viewport.spec.ts` PASS
- [ ] `npx playwright test tests/e2e/csp-console.spec.ts` PASS

## 수동 체크리스트

### 첫 진입
- [ ] 환영 카피(`welcome.intro`) 1줄 표시
- [ ] API 키 모달 자동 노출. ESC/배경 클릭 무효
- [ ] 발급 가이드 토글 펼침/접힘 동작
- [ ] 두 키 모두 입력해야 "저장" 활성화
- [ ] "모든 데이터 삭제" → ConfirmDialog → 확정 시 localStorage prefix 4종 모두 삭제

### URL 입력
- [ ] 잘못된 URL 4종 (도메인/videoId/플레이리스트/채널) → 각 인라인 에러
- [ ] blur 또는 Enter 시 메타 호출
- [ ] 같은 videoId 재입력 → 메타 재호출 안 함 (DevTools Network 탭 확인)
- [ ] 메타 1시간 캐시 — `videometa:{videoId}` 키가 localStorage에 존재

### 분석
- [ ] 진행 표시 ("댓글 모으는 중…" → "AI 분석 중…")
- [ ] "취소" 버튼 → idle 복귀
- [ ] 결과 6개 카드 모두 fade-in 진입

### 결과
- [ ] 결과 헤더에 분석 시점 + 표본 크기
- [ ] 면책 카피 하단 노출
- [ ] 댓글 < 10 시 lowConfidence 경고 (테스트용 mock으로)
- [ ] 캐시 히트 시 "{시간} 전 분석 · 캐시된 결과" + 재분석 강조

### 오프라인
- [ ] DevTools Network → Offline 토글 → 상단 배너 노출
- [ ] 분석 중 offline 진입 → 진행 중단 + 에러 표시
- [ ] online 복귀 → 배너 사라짐

### 에러 복구
- [ ] 잘못된 키로 분석 → AI_AUTH/YT_AUTH 에러 → 설정 모달 자동 오픈
- [ ] 키 수정 후 저장 → previous 복귀 (idle 아님)
- [ ] 에러 화면 "다시 시도" → previous 실행

### 접근성
- [ ] Tab만으로 모든 동작 가능
- [ ] focus ring 가시 (모든 인터랙티브 element)
- [ ] 모달 focus trap (Tab/Shift+Tab wrap)
- [ ] needs_keys 모달 ESC 무효, edit 모달 ESC 닫힘
- [ ] OS `prefers-reduced-motion: reduce` 설정 → fade-in 정지
- [ ] sentiment 차트 옆에 라벨 + 퍼센트 (색 없이 의미 파악)
- [ ] 키워드 태그가 색 + 카운트 + sentiment 라벨로 의미 전달

### 페이지 메타
- [ ] 분석 중 title = "분석 중… - YouTube 댓글 분석"
- [ ] 결과 도착 title = "{영상 제목} - 분석 결과"
- [ ] hash가 "분석 시작" 클릭 직후 갱신 (결과 도착 후 아님)

### 프라이버시
- [ ] 키 표시는 마스킹 (마지막 4자만)
- [ ] DevTools Network에 키가 다른 도메인으로 전송 안 됨
- [ ] ErrorBoundary fallback에서 외부 전송 호출 없음 (Network 탭 확인)

### PoC (사전 확인)
- [ ] step 5 시작 전 `npm run poc` 1회 성공
- [ ] 두 번째 호출에서 `cache_read_input_tokens > 0`
- [ ] 결과가 step 0 summary에 기록됨

## 발견 사항 (실행 후 기록)

(이슈가 있으면 여기에 기록 — code/문서 갱신 필요한 항목 분리)
```

### 의존성 추가 확인

`@playwright/test`는 step 0에서 이미 설치됨. 브라우저 바이너리 설치는 step 11에서 1회:
```bash
npx playwright install chromium
```

이 명령은 execute.py가 실행하기 어려우므로 step 0에서 미리 실행하거나, **step 11의 사전 작업으로 수동 실행** 안내 후 진행. 미설치면 `npx playwright test` 실패 → execute.py 재시도가 의미 없음 → 사용자 수동 실행 요청.

## Acceptance Criteria

```bash
npm run build && npm run lint && npm test
npx playwright install chromium    # 1회
npx playwright test
```

수동 (이 step의 완료 조건):
- `verification-report.md`의 자동 체크 4개 + 수동 체크리스트 통과
- 발견 사항은 별도 phase로 분리 결정

## 검증 절차

1. 자동 AC 통과 (Playwright 포함).
2. 체크리스트:
   - [ ] `tests/e2e/` 안 4개 spec 파일
   - [ ] `tests/fixtures/` mock JSON 3종
   - [ ] `phases/0-mvp/verification-report.md` 생성됨
   - [ ] Playwright 4개 시나리오 모두 PASS
   - [ ] 콘솔에 CSP 위반 / 미처리 에러 없음
   - [ ] 모바일 viewport 가로 스크롤 없음
3. **사용자 수동 검증**: 수동 체크리스트 실행 + 결과를 `verification-report.md`에 기록.
4. index.json 업데이트:
   - 모두 통과 → `"summary": "Playwright smoke 4종 PASS + 수동 체크리스트 통과. verification-report.md 작성."`
   - 일부 실패 → 발견 사항을 verification-report.md에 기록하고 후속 phase로 분리

## 금지사항

- **e2e에서 실제 API 호출 금지.** `page.route` mock만. 이유: BYOK + 비용/속도.
- **fixture에 실제 키 포함 금지.** placeholder 텍스트만. 이유: ADR-002.
- **flaky 테스트 그대로 두지 마라.** `expect.poll` 또는 `waitFor` 사용. 이유: CI 신뢰도.
- **production 코드를 e2e용으로 수정 금지.** 모든 변경은 `tests/` 안에서만. 이유: 단일 책임.
- **수동 체크리스트 결과를 임의 통과 처리 금지.** 실제 실행 후 기록. 이유: 검증 의미.
