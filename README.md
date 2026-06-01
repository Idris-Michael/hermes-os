# Hermes OS

A multi-service agency automation platform combining a React dashboard, an n8n workflow layer, and an agent orchestration bridge with idempotent job tickets.

> Public showcase build. Strategy briefs, client deliverables, and proprietary system prompts live in a private companion repo.

---

## What's in this repo

| Service | Stack | Purpose |
|---|---|---|
| **hermes-hub** | React 19 + Vite + Express + better-sqlite3 | Central dashboard. Tabs for GA4, Ads, Instagram, Discovery, Memory, Knowledge Base, Overwatch, Agent Pantheon. |
| **n8n-workflows** | n8n JSON exports | Lead capture routing, GA4 setup, weekly client reports, proposal generator, NotebookLM asset, heartbeat. |
| **bridge.ts** | TypeScript + Zod + UUID | Unified external tool entry point for all agents. Validation, audit logging, idempotency. |
| **Job Ticket protocol** | Markdown + JSON in vault | Filesystem semaphore for agent handoffs — claim → execute → resolve. |

---

## Architecture

```
External trigger (cron / webhook / Telegram)
  → hermes-hub  (dashboard, route dispatch)
    → n8n workflow  (orchestration)
      → bridge.execute(tool, payload)
        ├── obsidian      (read/write vault)
        ├── kanban        (delegate to overwatch board)
        ├── telegram      (notifications)
        ├── hf            (HuggingFace inference)
        └── instagram     (Meta Graph publish)
  → Job Ticket  (claim → process → resolve)
```

---

## Quick start

```bash
# 1. Install hermes-hub
cd hermes-hub
npm install
cp .env.example .env.local
# Fill in the keys you have

npm run dev   # Port 3000
```

Open <http://localhost:3000>.

---

## Bridge usage

```ts
import { bridgeExecute } from "./hermes-hub/src/lib/bridge";

// Schema-validated, UUID-tracked, audit-logged
const result = await bridgeExecute("obsidian", {
  action: "write",
  path: "Hermes OS/logs/heartbeat.json",
  content: JSON.stringify({ ts: new Date().toISOString(), status: "ok" }),
});
```

Every call:

- Validates payload against a Zod schema
- Generates a UUID `job_id` for tracing
- Appends `{ts, tool, job_id, ok, error}` to `logs/bridge-audit.jsonl`
- Returns `{ ok, data, error, job_id }`

---

## Job Ticket protocol

Tickets are markdown files at `Hermes OS/06 Memory/Active_Tasks/REQ-xxx.md`. Agents poll the directory, call `claimTicket(task_id)` which renames the file to `.processing` (filesystem semaphore — no double-processing), execute, then `resolveTicket()` which moves the file to `processed/` with the output appended.

See `Hermes OS/06 Memory/Active_Tasks/TICKET_TEMPLATE.md` for the schema and `bridge.ts` for the claim/resolve helpers.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Status

Active. Not production-stable. Component APIs may change.
