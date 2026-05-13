/**
 * ADR-031 PoC — Anthropic SDK 의 브라우저 호출 + 캐시 가정 검증.
 *
 * 두 시나리오 검증:
 *   A) 실제 SYSTEM_PROMPT (services/claude.ts 에 들어갈 분석 지침) 길이로 캐시 hit 검증
 *   B) 충분히 긴 padding 텍스트 (캐시 최소 임계값 ~2048 토큰을 확실히 넘김)
 *
 * 실행:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run poc
 */

import Anthropic from "@anthropic-ai/sdk";

// Scenario A: ARCHITECTURE.md 의 실제 SYSTEM_PROMPT (services/claude.ts 사용 예정)
const SYSTEM_REAL = `당신은 유튜브 댓글 분석가다.

[역할]
크리에이터에게 영상의 시청자 반응을 정량+정성적으로 요약한다.

[출력 형식]
반드시 JSON object만 출력. 추가 텍스트/마크다운 금지.
스키마:
{
  "summary": string (한두 문장),
  "detectedLanguage": string (BCP-47, 예: "ko", "en", "ja"),
  "sentiment": { "positive": number, "neutral": number, "negative": number }, // 합 = 100
  "strengths": [{ "point": string, "evidence": string[] }, ...] (0~5개),
  "improvements": [{ "point": string, "evidence": string[] }, ...] (0~5개),
  "keywords": [{ "term": string, "count": number, "sentiment": "pos"|"neu"|"neg" }, ...] (0~15개),
  "notableComments": [{ "text": string, "likes": number, "author": string }, ...] (0~10개)
}

[언어 규칙]
- 댓글의 주 언어를 감지해 summary/strengths/improvements/keywords 를 그 언어로 작성.
- 혼합 언어면 가장 많이 쓰인 언어 1개로 통일.

[분석 방향]
- 강점: 시청자가 반복적으로 칭찬한 영상 요소.
- 개선점: 시청자가 불만/요청한 패턴.
- 근거 댓글(evidence)은 입력 댓글에서 발췌. 임의로 생성·각색 금지.
- 충분한 패턴이 없으면 강점/개선점/키워드 배열을 빈 배열로 반환. 억지로 채우지 마라.

[금지]
- 개인 식별 정보(전화번호, 이메일) 노출.
- 입력에 없는 내용 추측.
- 단일 댓글에 의존한 결론.`;

// Scenario B: 충분히 긴 padding (수천 토큰)
const PADDING_LINE =
  "이것은 Anthropic prompt caching 최소 토큰 임계값(약 2048)을 확실히 넘기기 위한 padding 입니다. ";
const SYSTEM_PADDED =
  "다음 지침을 참고하라.\n\n" + PADDING_LINE.repeat(300) + "\n\n응답은 반드시 JSON 으로만 한다.";

interface PocResult {
  text: string;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  inputTokens: number;
  outputTokens: number;
}

async function callOnce(
  client: Anthropic,
  systemText: string,
  label: string,
): Promise<PocResult> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    system: [
      {
        type: "text",
        text: systemText,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: "ping" }],
  });

  const first = response.content[0];
  const text = first && first.type === "text" ? first.text : "";

  const usage = response.usage as unknown as {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  const result: PocResult = {
    text,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  };

  console.log(`  [${label}]`);
  console.log(`    text                              : ${JSON.stringify(text).slice(0, 80)}`);
  console.log(`    usage.input_tokens                : ${result.inputTokens}`);
  console.log(`    usage.output_tokens               : ${result.outputTokens}`);
  console.log(`    usage.cache_creation_input_tokens : ${result.cacheCreationInputTokens}`);
  console.log(`    usage.cache_read_input_tokens     : ${result.cacheReadInputTokens}`);

  return result;
}

interface ScenarioOutcome {
  name: string;
  chars: number;
  created: number;
  read: number;
  hit: boolean;
}

async function runScenario(
  client: Anthropic,
  name: string,
  systemText: string,
): Promise<ScenarioOutcome> {
  console.log(`\n========== Scenario ${name} (${systemText.length} chars) ==========`);
  const first = await callOnce(client, systemText, "1st call (캐시 생성 기대)");
  const second = await callOnce(client, systemText, "2nd call (캐시 hit 기대)");
  const hit = second.cacheReadInputTokens > 0;
  console.log(
    `  → cache: ${hit ? "OK" : "FAIL"} (1st created=${first.cacheCreationInputTokens}, 2nd read=${second.cacheReadInputTokens})`,
  );
  return {
    name,
    chars: systemText.length,
    created: first.cacheCreationInputTokens,
    read: second.cacheReadInputTokens,
    hit,
  };
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.\n" +
        "  실행 예: ANTHROPIC_API_KEY=sk-ant-... npm run poc",
    );
    process.exit(1);
  }

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log("ADR-031 PoC: Anthropic 브라우저 호출 + 캐시 가정 검증");
  console.log("model: claude-haiku-4-5-20251001");

  const scenarioA = await runScenario(client, "A — 실제 SYSTEM_PROMPT", SYSTEM_REAL);
  const scenarioB = await runScenario(client, "B — Padded (충분히 긴 텍스트)", SYSTEM_PADDED);

  console.log("\n========== 종합 ==========");
  console.log(
    `  A (실제 SYSTEM_PROMPT, ${scenarioA.chars}자): ${scenarioA.hit ? "OK" : "FAIL"} (1st created=${scenarioA.created}, 2nd read=${scenarioA.read})`,
  );
  console.log(
    `  B (Padded, ${scenarioB.chars}자): ${scenarioB.hit ? "OK" : "FAIL"} (1st created=${scenarioB.created}, 2nd read=${scenarioB.read})`,
  );

  if (!scenarioB.hit) {
    console.error(
      "\n[CRITICAL] Padded 시나리오마저 캐시 hit 실패. " +
        "SDK 버전 / cache_control 구조 / 모델 지원 여부 점검 필요. ADR-003 재검토.",
    );
    process.exit(2);
  }

  if (!scenarioA.hit) {
    console.warn(
      "\n[WARN] 실제 SYSTEM_PROMPT 길이로는 캐시 hit 안 됨 (Anthropic 캐시 최소 토큰 임계값 미달). " +
        "ADR-003 갱신 권장: SYSTEM_PROMPT 를 임계값 이상으로 늘리거나 cache_control 가정 제거.",
    );
    process.exit(3);
  }

  console.log("\nPoC 통과. dangerouslyAllowBrowser + ephemeral cache + 실제 프롬프트 길이 모두 정상.");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nPoC 실패: ${message}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
