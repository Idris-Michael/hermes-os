#!/usr/bin/env tsx
// Trigger a self-hosted n8n webhook workflow.
// Usage:
//   npx tsx scripts/trigger-n8n.ts <webhook-path> '<json-payload>'
//   npx tsx scripts/trigger-n8n.ts sc-intake '{"name":"Test","email":"a@b.com"}'
//
// Env override: N8N_BASE_URL (default http://localhost:5678)
// Mode override: N8N_WEBHOOK_MODE = "webhook" | "webhook-test"  (default "webhook")

const N8N_BASE_URL = process.env.N8N_BASE_URL ?? "http://localhost:5678";
const MODE = process.env.N8N_WEBHOOK_MODE ?? "webhook";

const KNOWN_PATHS = ["sc-intake", "sc-lead", "sc-nurture", "sc-invoice"] as const;

async function main(): Promise<void> {
  const [path, payloadRaw] = process.argv.slice(2);

  if (!path) {
    console.error("Usage: trigger-n8n.ts <path> [json-payload]");
    console.error(`Known paths: ${KNOWN_PATHS.join(", ")}`);
    process.exit(1);
  }

  let payload: unknown = {};
  if (payloadRaw) {
    try {
      payload = JSON.parse(payloadRaw);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Invalid JSON payload: ${msg}`);
      process.exit(1);
    }
  }

  const url = `${N8N_BASE_URL}/${MODE}/${path}`;
  const started = Date.now();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const elapsed = Date.now() - started;
  const text = await res.text();

  console.log(JSON.stringify({
    ok: res.ok,
    status: res.status,
    url,
    elapsedMs: elapsed,
    response: tryParseJson(text),
  }, null, 2));

  if (!res.ok) process.exit(1);
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Trigger failed: ${msg}`);
  process.exit(1);
});
