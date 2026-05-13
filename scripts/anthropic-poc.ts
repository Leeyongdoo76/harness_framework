/**
 * ADR-031 PoC — Anthropic SDK 의 브라우저 호출 가정 검증용 부트스트랩 스크립트.
 *
 * Node 에서 1회 실행해 다음을 확인한다:
 *   1) `dangerouslyAllowBrowser: true` 옵션이 SDK 타입/런타임에 받아들여지는가
 *   2) system content block + `cache_control: { type: "ephemeral" }` 호출이 200 OK 인가
 *   3) 동일 호출 반복 시 응답 `usage.cache_read_input_tokens > 0` 으로 캐시 hit 이 일어나는가
 *
 * 실행:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run poc
 *
 * 이 스크립트는 정식 코드가 아닌 부트스트랩 검증용이다. 결과는 phases/0-mvp/index.json
 * step 0 의 summary 에 사용자가 직접 기록해야 한다.
 */

import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_TEXT = 'Reply with exactly: {"ok":true}';

interface PocResult {
  text: string;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  inputTokens: number;
  outputTokens: number;
}

async function callOnce(client: Anthropic, label: string): Promise<PocResult> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    system: [
      {
        type: "text",
        text: SYSTEM_TEXT,
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

  console.log(`\n[${label}]`);
  console.log(`  text                          : ${JSON.stringify(text)}`);
  console.log(`  usage.input_tokens            : ${result.inputTokens}`);
  console.log(`  usage.output_tokens           : ${result.outputTokens}`);
  console.log(`  usage.cache_creation_input_tokens : ${result.cacheCreationInputTokens}`);
  console.log(`  usage.cache_read_input_tokens     : ${result.cacheReadInputTokens}`);

  return result;
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

  console.log("ADR-031 PoC: Anthropic 브라우저 호출 가정 검증");
  console.log("model: claude-haiku-4-5-20251001\n");

  const first = await callOnce(client, "1st call (캐시 생성)");
  const second = await callOnce(client, "2nd call (캐시 hit 기대)");

  console.log("\n--- 검증 결과 ---");
  const cacheHit = second.cacheReadInputTokens > 0;
  console.log(`  cache hit on 2nd call : ${cacheHit ? "OK" : "FAIL"}`);
  console.log(`  cache_read_input_tokens (2nd) : ${second.cacheReadInputTokens}`);

  if (!cacheHit) {
    console.error(
      "\n캐시 hit 미검증. system content block + cache_control 응답에 " +
        "cache_read_input_tokens 가 0 입니다. ADR-003 / SDK 버전 / 모델 확인 필요.",
    );
    process.exit(2);
  }

  if (first.cacheCreationInputTokens === 0 && second.cacheReadInputTokens === 0) {
    console.error("\n캐시 동작 안 함. cache_creation / cache_read 모두 0.");
    process.exit(2);
  }

  console.log("\nPoC 통과. dangerouslyAllowBrowser + ephemeral cache 모두 정상 동작.");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nPoC 실패: ${message}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
