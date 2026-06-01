// Hermes Orchestrator — natural-language agency assistant with tool-use.
// Loops: user msg → model → (tool calls → execute → feed back)* → final reply.
//
// Wired to Llama 3.3 70B on Cerebras via HF Pro router. Conversation history
// is persisted per chat_id in SQLite so the assistant has continuity.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

// Resolve hermes-hub root from this file's location (src/lib/orchestrator.ts → ../..)
const __orch_dir = path.dirname(fileURLToPath(import.meta.url));
const HUB_ROOT = path.resolve(__orch_dir, "..", "..");

// ─── HF model config ────────────────────────────────────────────────────────
const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL_DEFAULT = "deepseek-ai/DeepSeek-V4-Flash:novita";

// Model list lives in src/lib/models.ts (browser-safe). Kept here for server-side validation.
const HF_MODEL_IDS = new Set([
  "Qwen/Qwen3.6-35B-A3B:featherless-ai",
  "deepseek-ai/DeepSeek-V4-Pro:novita",
  "deepseek-ai/DeepSeek-V4-Flash:novita",
  "deepseek-ai/DeepSeek-V3-0324:novita",
  "meta-llama/Llama-3.3-70B-Instruct:groq",
  "Qwen/Qwen3-32B:groq",
  "meta-llama/Llama-4-Scout-17B-16E-Instruct:groq",
  "moonshotai/Kimi-K2.6:novita",
  "meta-llama/Llama-3.3-70B-Instruct:cerebras",
  "mistralai/Mistral-Small-3.2-24B-Instruct-2506:nebius",
]);
const MAX_TURNS = 5;          // hard cap on tool-call round trips per message
const MAX_HISTORY = 20;       // last N (user+assistant) messages kept in context
const HUB = "http://localhost:3000";

// ─── Allowlists for filesystem tools ────────────────────────────────────────
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT || "C:/Users/profs/Desktop/Sandbox";

const ALLOWED_ROOTS = [
  "C:/Users/profs/Documents/Hermes",
  "C:/Users/profs/Downloads",
  "C:/Users/profs/Documents/Obsidian Vault",
  "C:/Users/profs/Desktop/Sandbox",
  OBSIDIAN_VAULT,
].map((p) => path.resolve(p));

function isAllowed(target: string): boolean {
  const abs = path.resolve(target);
  return ALLOWED_ROOTS.some((root) => abs === root || abs.startsWith(root + path.sep));
}

// ─── Chat history (per chat_id) ─────────────────────────────────────────────
const dbPath = path.join(HUB_ROOT, "data.db");
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_history_chat_id ON chat_history(chat_id, created_at);
`);

interface ChatMessage { role: "user" | "assistant" | "system"; content: string }

function loadHistory(chatId: string): ChatMessage[] {
  const rows = db
    .prepare("SELECT role, content FROM chat_history WHERE chat_id = ? ORDER BY id DESC LIMIT ?")
    .all(chatId, MAX_HISTORY) as Array<{ role: string; content: string }>;
  return rows.reverse().map((r) => ({ role: r.role as ChatMessage["role"], content: r.content }));
}

function saveTurn(chatId: string, role: ChatMessage["role"], content: string): void {
  db.prepare("INSERT INTO chat_history (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)")
    .run(chatId, role, content, Date.now());
}

export function clearHistory(chatId: string): void {
  db.prepare("DELETE FROM chat_history WHERE chat_id = ?").run(chatId);
}

export interface ConversationSummary {
  chat_id: string;
  title: string;
  last_message_at: number;
  message_count: number;
}

export function listConversations(): ConversationSummary[] {
  const rows = db.prepare(`
    SELECT chat_id,
           MAX(created_at) AS last_message_at,
           COUNT(*)        AS message_count
    FROM chat_history
    GROUP BY chat_id
    ORDER BY last_message_at DESC
  `).all() as Array<{ chat_id: string; last_message_at: number; message_count: number }>;

  const titleStmt = db.prepare(
    "SELECT content FROM chat_history WHERE chat_id = ? AND role = 'user' ORDER BY id ASC LIMIT 1"
  );
  return rows.map((r) => {
    const first = titleStmt.get(r.chat_id) as { content: string } | undefined;
    const raw = (first?.content ?? r.chat_id).replace(/\s+/g, " ").trim();
    const title = raw.length > 60 ? raw.slice(0, 57) + "…" : raw || r.chat_id;
    return { chat_id: r.chat_id, title, last_message_at: r.last_message_at, message_count: r.message_count };
  });
}

export interface HistoryMessage { role: "user" | "assistant" | "system"; content: string; created_at: number }

export function loadFullHistory(chatId: string): HistoryMessage[] {
  return db.prepare(
    "SELECT role, content, created_at FROM chat_history WHERE chat_id = ? ORDER BY id ASC"
  ).all(chatId) as HistoryMessage[];
}

// ─── Scheduled tasks schema ─────────────────────────────────────────────────
function ensureScheduledTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at INTEGER NOT NULL,
      tool TEXT NOT NULL,
      args TEXT NOT NULL,
      recurrence TEXT,
      notify_chat_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      last_fired_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_run_at ON scheduled_tasks(status, run_at);
  `);
  // Soft migration for existing installs that had the older schema
  const cols = db.prepare("PRAGMA table_info(scheduled_tasks)").all() as Array<{ name: string }>;
  const have = new Set(cols.map((c) => c.name));
  for (const [col, ddl] of [
    ["recurrence", "ALTER TABLE scheduled_tasks ADD COLUMN recurrence TEXT"],
    ["notify_chat_id", "ALTER TABLE scheduled_tasks ADD COLUMN notify_chat_id TEXT"],
    ["last_error", "ALTER TABLE scheduled_tasks ADD COLUMN last_error TEXT"],
    ["last_fired_at", "ALTER TABLE scheduled_tasks ADD COLUMN last_fired_at INTEGER"],
  ] as const) {
    if (!have.has(col)) {
      try { db.exec(ddl); } catch { /* column may race-exist */ }
    }
  }
}
ensureScheduledTable();

// ─── Tool definitions ───────────────────────────────────────────────────────
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

interface ToolDef {
  description: string;
  args: string;          // human-readable arg signature
  handler: ToolHandler;
}

const TOOLS: Record<string, ToolDef> = {
  // ── Memory & files ──────────────────────────────────────────────────────
  read_file: {
    description: "Read a text file from disk. Allowlisted to Hermes repo, Downloads, Obsidian Vault, Sandbox.",
    args: "{ path: string }",
    handler: async ({ path: p }) => {
      const target = String(p);
      if (!isAllowed(target)) throw new Error(`Path not allowlisted: ${target}`);
      if (!fs.existsSync(target)) throw new Error(`File not found: ${target}`);
      const stat = fs.statSync(target);
      if (stat.size > 200_000) throw new Error(`File too large (${stat.size} bytes, max 200KB)`);
      return { content: fs.readFileSync(target, "utf8"), bytes: stat.size };
    },
  },
  write_file: {
    description: "Write or overwrite a text file. Allowlisted paths only.",
    args: "{ path: string, content: string }",
    handler: async ({ path: p, content }) => {
      const target = String(p);
      if (!isAllowed(target)) throw new Error(`Path not allowlisted: ${target}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, String(content), "utf8");
      return { written: target, bytes: Buffer.byteLength(String(content)) };
    },
  },
  list_dir: {
    description: "List files in a directory. Allowlisted paths only.",
    args: "{ path: string }",
    handler: async ({ path: p }) => {
      const target = String(p);
      if (!isAllowed(target)) throw new Error(`Path not allowlisted: ${target}`);
      if (!fs.existsSync(target)) throw new Error(`Directory not found: ${target}`);
      const entries = fs.readdirSync(target, { withFileTypes: true });
      return entries.slice(0, 80).map((e) => ({ name: e.name, type: e.isDirectory() ? "dir" : "file" }));
    },
  },
  vault_search: {
    description: "Full-text search across the Obsidian vault. Returns matching note paths + excerpts.",
    args: "{ query: string }",
    handler: async ({ query }) => {
      const r = await fetch(`${HUB}/api/discovery/vault/search?q=${encodeURIComponent(String(query))}`);
      return await r.json();
    },
  },
  vault_read: {
    description: "Read a specific Obsidian note by its vault-relative path.",
    args: "{ path: string }",
    handler: async ({ path: p }) => {
      const full = path.join(OBSIDIAN_VAULT, String(p));
      if (!isAllowed(full)) throw new Error(`Path not allowlisted: ${full}`);
      if (!fs.existsSync(full)) throw new Error(`Note not found: ${p}`);
      return { content: fs.readFileSync(full, "utf8") };
    },
  },
  vault_write: {
    description: "Create or update an Obsidian note. Use forward slashes for vault-relative paths.",
    args: "{ path: string, content: string }",
    handler: async ({ path: p, content }) => {
      const full = path.join(OBSIDIAN_VAULT, String(p));
      if (!isAllowed(full)) throw new Error(`Path not allowlisted: ${full}`);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, String(content), "utf8");
      return { written: p };
    },
  },
  notebooklm_add: {
    description: "Push a URL or text into a NotebookLM notebook.",
    args: "{ url_or_text: string, notebook?: string }",
    handler: async ({ url_or_text, notebook }) => {
      // Stub — wires to existing notebooklm-py script. For v1 we log intent + path.
      const target = path.join("C:/Users/profs/Documents/Hermes/notebooklm-py", "queue.jsonl");
      fs.appendFileSync(target, JSON.stringify({ url_or_text, notebook: notebook ?? "default", ts: Date.now() }) + "\n");
      return { queued: true, notebook: notebook ?? "default" };
    },
  },
  kb_repos: {
    description: "List indexed Knowledge Base repos/sources visible to the Hermes hub. Use to discover what's available before vault_search or kb_graph.",
    args: "{}",
    handler: async () => {
      const r = await fetch(`${HUB}/api/vault/repos`);
      return await r.json();
    },
  },
  kb_notebooks: {
    description: "List synced NotebookLM notebooks (id, title, source_count, updated). Call before notebooklm_add to choose the correct notebook.",
    args: "{}",
    handler: async () => {
      const r = await fetch(`${HUB}/api/discovery/notebooks`);
      return await r.json();
    },
  },
  kb_graph: {
    description: "Return the Knowledge Base constellation graph (nodes + links across projects/skills/systems/areas/generated). Pass an optional query to filter nodes by label substring.",
    args: "{ query?: string, limit?: number }",
    handler: async ({ query, limit }) => {
      const r = await fetch(`${HUB}/api/constellation`);
      const data = await r.json() as { nodes?: Array<{ id: string; label: string; group: string }>; links?: Array<{ source: string; target: string }> };
      const nodes = data.nodes ?? [];
      const links = data.links ?? [];
      const cap = typeof limit === "number" && limit > 0 ? Math.min(limit, 200) : 50;
      if (!query) {
        return { total_nodes: nodes.length, total_links: links.length, nodes: nodes.slice(0, cap) };
      }
      const q = String(query).toLowerCase();
      const matched = nodes.filter((n) => (n.label ?? "").toLowerCase().includes(q) || (n.id ?? "").toLowerCase().includes(q));
      const matchedIds = new Set(matched.map((n) => n.id));
      const related = links.filter((l) => matchedIds.has(l.source) || matchedIds.has(l.target));
      return { query, matched_count: matched.length, nodes: matched.slice(0, cap), links: related.slice(0, cap * 2) };
    },
  },

  // ── Orchestration ───────────────────────────────────────────────────────
  delegate: {
    description: "Delegate a task to a Pantheon agent (jack/queen/king/ace × diamonds/hearts/clubs/spades). Fire-and-forget; check status with list_tasks.",
    args: "{ agent: string, brief: string }",
    handler: async ({ agent, brief }) => {
      const r = await fetch(`${HUB}/api/swarm/task`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: `[@${agent}] ${brief}` }),
      });
      return await r.json();
    },
  },
  list_tasks: {
    description: "List recent tasks in the queue. Optional filter by agent or status.",
    args: "{ agent?: string, status?: 'queued'|'in_progress'|'done' }",
    handler: async ({ agent, status }) => {
      const r = await fetch(`${HUB}/api/swarm/tasks`);
      const all = await r.json() as Array<{ agent: string; status: string; brief: string; id: string }>;
      return all.filter((t) =>
        (!agent || t.agent === agent) && (!status || t.status === status)
      ).slice(0, 15);
    },
  },
  kanban_view: {
    description: "View the kanban board. Optional filter by column.",
    args: "{ column?: string }",
    handler: async ({ column }) => {
      const r = await fetch(`${HUB}/api/kanban`);
      const board = await r.json() as Record<string, unknown>;
      if (column) return { [String(column)]: board[String(column)] };
      return board;
    },
  },
  kanban_move: {
    description: "Move a kanban card to a different column.",
    args: "{ card_id: string, to_column: string }",
    handler: async ({ card_id, to_column }) => {
      const cur = await fetch(`${HUB}/api/kanban`).then((r) => r.json()) as Record<string, Array<{ id: string }>>;
      let card: unknown = null;
      for (const col of Object.keys(cur)) {
        const idx = cur[col].findIndex((c) => c.id === card_id);
        if (idx >= 0) { card = cur[col][idx]; cur[col].splice(idx, 1); break; }
      }
      if (!card) throw new Error(`Card not found: ${card_id}`);
      if (!cur[String(to_column)]) cur[String(to_column)] = [];
      cur[String(to_column)].push(card as { id: string });
      await fetch(`${HUB}/api/kanban`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cur),
      });
      return { moved: card_id, to: to_column };
    },
  },
  whats_pending: {
    description: "Summary digest of what needs the user's attention: pending IG approvals, in-progress tasks, recent task completions.",
    args: "{}",
    handler: async () => {
      const [igQueue, tasks] = await Promise.all([
        fetch(`${HUB}/api/ig/queue`).then((r) => r.json()).catch(() => []),
        fetch(`${HUB}/api/swarm/tasks`).then((r) => r.json()).catch(() => []),
      ]);
      const queue = Array.isArray(igQueue) ? igQueue : [];
      const t = Array.isArray(tasks) ? tasks : [];
      return {
        ig_pending_approval: queue.filter((s: { approval_state?: string }) => s.approval_state === "pending").length,
        tasks_in_progress: t.filter((x: { status?: string }) => x.status === "in_progress").length,
        tasks_queued: t.filter((x: { status?: string }) => x.status === "queued").length,
        recent_completions: t.filter((x: { status?: string }) => x.status === "done").slice(0, 5),
      };
    },
  },
  schedule: {
    description: "Schedule a future tool call. Supports one-off ('tomorrow 9am', 'in 2 hours', ISO date) or recurring ('every friday 9am', 'every day 7am', 'every monday wednesday 8am'). Worker picks it up within 30s of run_at.",
    args: "{ when: string, tool: string, args?: object, notify_chat_id?: string }",
    handler: async ({ when, tool, args, notify_chat_id }) => {
      ensureScheduledTable();
      const whenStr = String(when);
      const runAt = parseWhen(whenStr);
      const recurrence = /^every\s/i.test(whenStr.trim()) ? whenStr.trim() : null;
      const row = db.prepare(
        "INSERT INTO scheduled_tasks (run_at, tool, args, recurrence, notify_chat_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
      ).run(runAt, String(tool), JSON.stringify(args ?? {}), recurrence, notify_chat_id ? String(notify_chat_id) : null, Date.now());
      return {
        id: row.lastInsertRowid,
        run_at: new Date(runAt).toISOString(),
        recurrence,
      };
    },
  },
  list_scheduled: {
    description: "List upcoming or recurring scheduled tasks. Most recent first.",
    args: "{ status?: 'pending' | 'done' | 'errored' | 'cancelled' }",
    handler: async ({ status }) => {
      ensureScheduledTable();
      const rows = status
        ? db.prepare("SELECT id, run_at, tool, args, recurrence, status, last_error FROM scheduled_tasks WHERE status = ? ORDER BY run_at LIMIT 20").all(String(status))
        : db.prepare("SELECT id, run_at, tool, args, recurrence, status, last_error FROM scheduled_tasks WHERE status IN ('pending','errored') ORDER BY run_at LIMIT 20").all();
      return (rows as Array<{ run_at: number; args: string;[k: string]: unknown }>).map((r) => ({
        ...r,
        run_at: new Date(r.run_at).toISOString(),
        args: (() => { try { return JSON.parse(r.args); } catch { return r.args; } })(),
      }));
    },
  },
  cancel_scheduled: {
    description: "Cancel a scheduled task by id (won't fire again, even if recurring).",
    args: "{ id: number }",
    handler: async ({ id }) => {
      ensureScheduledTable();
      const row = db.prepare("UPDATE scheduled_tasks SET status = 'cancelled' WHERE id = ?").run(Number(id));
      return { cancelled: row.changes > 0, id: Number(id) };
    },
  },

  // ── Content pipeline ────────────────────────────────────────────────────
  ig_queue: {
    description: "Show the current Instagram approval queue (pending reels awaiting review).",
    args: "{}",
    handler: async () => await (await fetch(`${HUB}/api/ig/queue`)).json(),
  },
  ig_render: {
    description: "Kick off a new reel render. Pillar is one of: case-study, ga4-tip, ads-tip, process-breakdown, client-result.",
    args: "{ pillar: string, topic?: string }",
    handler: async ({ pillar, topic }) => {
      const r = await fetch(`${HUB}/api/swarm/task`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: `[@queen-of-hearts] Render IG reel — pillar=${pillar} topic="${topic ?? "auto"}".` }),
      });
      return await r.json();
    },
  },
  ig_approve: {
    description: "Approve a specific reel variant in the queue.",
    args: "{ slot_id: string, variant_id: string }",
    handler: async ({ slot_id, variant_id }) => {
      const r = await fetch(`${HUB}/api/ig/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slot_id, variant_id }),
      });
      return await r.json();
    },
  },
  ig_reject: {
    description: "Reject a reel slot. Optionally with feedback.",
    args: "{ slot_id: string, reason?: string }",
    handler: async ({ slot_id, reason }) => {
      const r = await fetch(`${HUB}/api/ig/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slot_id, reason }),
      });
      return await r.json();
    },
  },
  ig_metrics: {
    description: "Get Instagram performance metrics (reach, engagement, recent posts).",
    args: "{ days?: number }",
    handler: async () => await (await fetch(`${HUB}/api/ig/metrics`)).json(),
  },
  analyze_creative: {
    description: "Run vision analysis on a reel/image URL via Gemini. Returns hook structure + improvement notes.",
    args: "{ url: string }",
    handler: async ({ url }) => {
      // Routes through n8n workflow 09 via Telegram dispatch trick
      const r = await fetch(`${HUB}/api/swarm/task`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: `[@ace-of-hearts] Vision-analyze creative at: ${url}` }),
      });
      return await r.json();
    },
  },
  clip_video: {
    description: "Extract a clip from a long-form video URL via OpenShorts. Requires the OpenShorts docker container running on :8000.",
    args: "{ url: string, in_sec: number, out_sec: number }",
    handler: async ({ url, in_sec, out_sec }) => {
      const r = await fetch(`${HUB}/api/openshorts/clip`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, in: in_sec, out: out_sec }),
      });
      const data = await r.json() as Record<string, unknown>;
      if (r.status === 503) return { offline: true, ...data };
      return data;
    },
  },
  generate_image: {
    description: "Generate an image with FLUX from a text prompt.",
    args: "{ prompt: string, width?: number, height?: number }",
    handler: async ({ prompt, width, height }) => {
      const r = await fetch(`${HUB}/api/flux/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, width: width ?? 1024, height: height ?? 1024 }),
      });
      return await r.json();
    },
  },
  synthesize_voice: {
    description: "Generate a voiceover from text. Uses Gemini TTS by default.",
    args: "{ text: string, voice?: string }",
    handler: async ({ text, voice }) => {
      const r = await fetch(`${HUB}/api/tts/synthesize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voice: voice ?? "default" }),
      });
      return await r.json();
    },
  },
  make_deck: {
    description: "Generate a slide deck via Studio. Brief is passed as STUDIO_BRIEF env to generate-slides.mjs. Output lands in studio-exports/.",
    args: "{ brief: string }",
    handler: async ({ brief }) => {
      const r = await fetch(`${HUB}/api/studio/render`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      return await r.json();
    },
  },

  // ── Agency ops ──────────────────────────────────────────────────────────
  client_get: {
    description: "Look up a client by name. Returns brief, account IDs, status, contacts.",
    args: "{ name: string }",
    handler: async ({ name }) => {
      const all = await (await fetch(`${HUB}/api/clients`)).json() as Array<{ name: string }>;
      const match = all.find((c) => c.name?.toLowerCase().includes(String(name).toLowerCase()));
      return match ?? { error: `No client matching "${name}"` };
    },
  },
  client_create: {
    description: "Create a new client record.",
    args: "{ name: string, industry?: string, contact?: string, notes?: string }",
    handler: async (args) => {
      const r = await fetch(`${HUB}/api/clients`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
      });
      return await r.json();
    },
  },
  client_list: {
    description: "List all clients.",
    args: "{}",
    handler: async () => await (await fetch(`${HUB}/api/clients`)).json(),
  },
  audit: {
    description: "Trigger an audit. Platform: ga4 | meta | google | upwork | linkedin.",
    args: "{ platform: string, client?: string }",
    handler: async ({ platform, client }) => {
      const platformAgent: Record<string, string> = {
        ga4: "king-of-clubs", meta: "queen-of-spades", google: "king-of-spades",
        upwork: "jack-of-diamonds", linkedin: "queen-of-diamonds",
      };
      const agent = platformAgent[String(platform).toLowerCase()];
      if (!agent) throw new Error(`Unknown platform: ${platform}. Use: ${Object.keys(platformAgent).join(", ")}`);
      const brief = `${String(platform).toUpperCase()} audit for ${client ?? "current client"}.`;
      const r = await fetch(`${HUB}/api/swarm/task`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: `[@${agent}] ${brief}` }),
      });
      return await r.json();
    },
  },
  research: {
    description: "Run OpenClaw web research on a topic. Async — check logs after.",
    args: "{ topic: string }",
    handler: async ({ topic }) => {
      const r = await fetch(`${HUB}/api/openclaw/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      return await r.json();
    },
  },
  discover: {
    description: "Analyse a lead or competitor URL — pulls public signals, classifies fit.",
    args: "{ target: string }",
    handler: async ({ target }) => {
      const r = await fetch(`${HUB}/api/discovery/analyse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      return await r.json();
    },
  },

  // ── External ────────────────────────────────────────────────────────────
  web_fetch: {
    description: "Fetch a URL and return the response body (HTML/JSON/text).",
    args: "{ url: string }",
    handler: async ({ url }) => {
      const r = await fetch(String(url), { headers: { "user-agent": "Mozilla/5.0 Hermes/1.0" } });
      const text = await r.text();
      return { status: r.status, body: text.slice(0, 8000) };
    },
  },

  // ── Upwork lead audit ───────────────────────────────────────────────────
  audit_upwork: {
    description: "Score the latest Upwork jobs against the bio + Proposer rules. Returns top 3 fits with verdicts and drafted proposals. Use 'focus' to bias the audit (e.g. 'GA4 only', 'audit jobs only').",
    args: "{ focus?: string, top_n?: number }",
    handler: async ({ focus, top_n }) => {
      const promptsDir = path.resolve(process.cwd(), "..", "severus-connects-prompts");
      const bioPath = path.join(promptsDir, "Upwork_Bio_2026.md");
      const feedPath = path.join(promptsDir, "Upwork_Agentic_AI_Jobs_May2026.md");
      const proposerPath = path.join(promptsDir, "07-AGENT-Proposer.md");

      for (const p of [bioPath, feedPath, proposerPath]) {
        if (!fs.existsSync(p)) throw new Error(`Missing required file: ${path.basename(p)}`);
      }

      const bio = fs.readFileSync(bioPath, "utf8");
      const feed = fs.readFileSync(feedPath, "utf8");
      const proposer = fs.readFileSync(proposerPath, "utf8");

      // Count actual jobs in the feed
      const jobBlocks = feed.split(/\n---\n/g).filter((b) => /^###\s+/m.test(b));
      if (jobBlocks.length === 0) {
        return {
          jobs_in_feed: 0,
          message: "Feed is empty. Configure UPWORK_RSS_URLS in .env.local and call upwork_feed_refresh, or use upwork_feed_add to paste a job manually.",
        };
      }

      const topN = Math.min(Math.max(Number(top_n ?? 3), 1), 5);
      const focusLine = focus ? `\n\nFOCUS: ${String(focus)}` : "";

      // Call HF directly with the Proposer prompt + bio + feed.
      // Bypass the orchestrator's own tool-loop — this is a single deterministic call.
      const hfToken = process.env.HF_API_TOKEN;
      if (!hfToken) throw new Error("HF_API_TOKEN not configured");
      const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${hfToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "Qwen/Qwen3.6-35B-A3B:featherless-ai",
          temperature: 0.2,
          max_tokens: 2500,
          messages: [
            { role: "system", content: `${proposer}\n\n## Upwork Bio (Idris's source of truth)\n\n${bio}` },
            { role: "user", content: `Here is the current Upwork job feed. Score every job per your scoring table, then return the top ${topN} (highest scores first). For each, output the full block: SCORE / VERDICT / RATIONALE / TEMPLATE / RED_FLAGS, and if Apply, the proposal text. Skip jobs scoring < 5 entirely — do not include them. If fewer than ${topN} score ≥ 5, return fewer.${focusLine}\n\n---\n\n${feed.slice(0, 15000)}` },
          ],
        }),
      });
      const data = await r.json() as { choices?: Array<{ message: { content: string } }>; error?: { message?: string } };
      if (data.error) throw new Error(`Llama error: ${data.error.message ?? "unknown"}`);
      const output = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();

      return {
        jobs_in_feed: jobBlocks.length,
        focus: focus ?? null,
        top_n: topN,
        audit: output,
      };
    },
  },
  upwork_feed_refresh: {
    description: "Pull the latest Upwork jobs from configured RSS saved-search URLs and append to the feed file (deduped).",
    args: "{}",
    handler: async () => {
      const { fetchUpworkFeeds } = await import("./upworkFeed.js");
      return await fetchUpworkFeeds();
    },
  },
  upwork_feed_add: {
    description: "Manually append an Upwork job to the feed (when you forward a brief from the Upwork app).",
    args: "{ title: string, job_text: string, link?: string }",
    handler: async ({ title, job_text, link }) => {
      const { appendManualJob } = await import("./upworkFeed.js");
      appendManualJob(String(title), String(job_text), link ? String(link) : undefined);
      return { added: true, title: String(title) };
    },
  },
};

// ─── Natural-language scheduling parser ─────────────────────────────────────
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseHHMM(text: string, defaultHour = 9): { hour: number; minute: number } {
  // Matches "9am", "09:00", "5pm", "17:30", "at 8"
  const ampm = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const meridiem = ampm[3].toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return { hour: h, minute: m };
  }
  const hhmm = text.match(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/);
  if (hhmm) return { hour: parseInt(hhmm[1], 10), minute: parseInt(hhmm[2], 10) };
  const hourOnly = text.match(/\bat\s+(\d{1,2})\b/);
  if (hourOnly) return { hour: parseInt(hourOnly[1], 10), minute: 0 };
  return { hour: defaultHour, minute: 0 };
}

// Compute the next run time for a recurring spec ("every friday 9am",
// "every day 7am", "every monday wednesday friday 8am").
// Always returns a strictly-future timestamp relative to `from`.
function nextRecurrence(spec: string, from: number = Date.now()): number {
  const lower = spec.toLowerCase().trim();
  const { hour, minute } = parseHHMM(lower);
  const fromDate = new Date(from);

  // "every day"
  if (/\bevery\s+(day|morning|evening|night)\b/.test(lower)) {
    const t = new Date(fromDate);
    t.setHours(hour, minute, 0, 0);
    if (t.getTime() <= from) t.setDate(t.getDate() + 1);
    return t.getTime();
  }

  // "every weekday" → Mon–Fri
  if (/\bevery\s+weekday\b/.test(lower)) {
    const t = new Date(fromDate);
    t.setHours(hour, minute, 0, 0);
    do {
      if (t.getTime() <= from) t.setDate(t.getDate() + 1);
      else if (t.getDay() === 0 || t.getDay() === 6) t.setDate(t.getDate() + 1);
      else break;
    } while (true);
    return t.getTime();
  }

  // "every hour" / "every N hours"
  const everyHours = lower.match(/\bevery\s+(\d+\s+)?hour/);
  if (everyHours) {
    const n = everyHours[1] ? parseInt(everyHours[1].trim(), 10) : 1;
    return from + n * 3_600_000;
  }

  // "every monday", "every monday wednesday friday"
  const days = DAY_NAMES.filter((d) => new RegExp(`\\b${d}\\b`).test(lower));
  if (days.length > 0) {
    const targetDays = new Set(days.map((d) => DAY_NAMES.indexOf(d)));
    // Search forward up to 8 days
    for (let offset = 0; offset < 8; offset++) {
      const t = new Date(fromDate);
      t.setDate(t.getDate() + offset);
      t.setHours(hour, minute, 0, 0);
      if (targetDays.has(t.getDay()) && t.getTime() > from) return t.getTime();
    }
  }

  // Fallback: 24h from now
  return from + 86_400_000;
}

function parseWhen(input: string): number {
  // ISO timestamp?
  const iso = Date.parse(input);
  if (!Number.isNaN(iso)) return iso;
  const lower = input.toLowerCase().trim();

  // Recurring → use nextRecurrence
  if (lower.startsWith("every ")) return nextRecurrence(lower);

  const now = new Date();
  // "in X minutes/hours/days"
  const inMatch = lower.match(/in (\d+)\s*(min|minute|minutes|hour|hours|day|days)/);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const mult = unit.startsWith("min") ? 60_000 : unit.startsWith("hour") ? 3_600_000 : 86_400_000;
    return Date.now() + n * mult;
  }
  // "tomorrow [at HH:MM]"
  if (lower.startsWith("tomorrow")) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    const { hour, minute } = parseHHMM(lower);
    t.setHours(hour, minute, 0, 0);
    return t.getTime();
  }
  // "today at 5pm" / "at 5pm"
  if (lower.startsWith("today") || lower.startsWith("at ")) {
    const t = new Date(now);
    const { hour, minute } = parseHHMM(lower);
    t.setHours(hour, minute, 0, 0);
    if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
    return t.getTime();
  }
  // Day of week without "every" → next occurrence
  const dayMatch = DAY_NAMES.find((d) => new RegExp(`\\b${d}\\b`).test(lower));
  if (dayMatch) return nextRecurrence("every " + lower);

  // Default: 1 hour from now
  return Date.now() + 3_600_000;
}

export { nextRecurrence };

// ─── System prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Hermes, the orchestrator AI for Severus Connects — a London digital agency run by Idris (GA4 analytics, AI Google Ads, AI Instagram pipeline). You help Idris run the agency from his phone.

You have a Pantheon of 15 specialised agents you can delegate to:
• jack-of-diamonds — Agency social growth (@severus_connects IG)
• queen-of-diamonds — LinkedIn growth & agency positioning
• king-of-diamonds — Shopping/ecomm ads
• ace-of-diamonds — Biz dev, outreach, ICP scoring
• queen-of-hearts — UGC + reel rendering pipeline
• king-of-hearts — Ad copy (headlines, primary text, CTAs)
• ace-of-hearts — Creative direction, vision analysis
• king-of-clubs — GA4 audits, conversion tracking
• queen-of-clubs — Accessibility (WCAG 2.2)
• jack-of-clubs — Engineering builds, features, infra
• ace-of-clubs — n8n automation, cron flows
• queen-of-spades — Meta Ads (Pixel/CAPI, learning phase, Advantage+)
• king-of-spades — Google Ads (Quality Score, PMax, wasted spend)
• ace-of-spades — Campaign strategy, positioning, funnel
• jack-of-spades — Bundle orchestration, deliverable stacks

You have TOOLS. To call a tool, output ONLY a JSON object on a single line:
{"tool":"tool_name","args":{...}}

You may call multiple tools across turns. After each tool result, decide if you need more tools or if you can answer. When ready to answer the user, output your reply as plain prose (no JSON).

Available tools:
${Object.entries(TOOLS).map(([name, def]) => `• ${name}${def.args} — ${def.description}`).join("\n")}

Rules:
- Be direct. No filler. Idris is an expert.
- When the user asks you to "do X", DO IT via tools — don't just describe.
- When delegating to an agent, write a tight brief — that agent will execute it.
- For multi-step requests: plan first (mentally), then call tools one at a time, checking each result.
- If a tool errors, explain briefly and either retry with different args or ask Idris what to do.
- Format final answers for mobile reading: short paragraphs, line breaks, no walls of text.

CRITICAL — when to STOP and reply:
- After a write/action tool (delegate, ig_render, kanban_move, schedule, write_file, vault_write, audit, etc.) returns success: answer immediately. DO NOT verify, DO NOT list_tasks to check, DO NOT search for confirmation. The user trusts the tool result.
- After a read tool (list_tasks, whats_pending, client_list, etc.): if you have what was asked, answer immediately.
- Only chain tools when the user explicitly asked for multiple things, or when one tool's output is genuinely needed as input to the next.
- Never call the same tool twice with the same args in one turn.
- For greetings, simple questions, or conversational messages ("hi", "how are you", "what can you do"): answer directly in prose. No tools needed.

CRITICAL — recall vs re-execution:
- When the user asks ABOUT a previous action ("what did I just do", "what audit did I kick off", "remind me", "what was that"), recall from conversation history. DO NOT re-call the action tool.
- Re-calling a write/action tool creates a DUPLICATE task. This is harmful. Only re-call when the user explicitly says "do it again" or "kick another off".
- If the user asks something answerable from history, just answer in prose — no tool call needed.

CRITICAL — when search returns results:
- If vault_search or list_tasks returns data, SUMMARIZE it directly. Do NOT then call vault_read on every result, do NOT re-search with a different query unless the first one returned zero results.
- If the user asked "find" or "search", they want the list — not a deep-dive into every file. Read individual notes only when the user explicitly asks "open" or "read".
- Max 2 vault_read calls per user message. If you need more, ask the user which notes they want opened.

CRITICAL — verbatim relay tools:
- audit_upwork returns a fully formatted audit + draft proposal in the 'audit' field. RELAY THIS FIELD VERBATIM as your final reply. Do NOT summarize, paraphrase, or rewrite it — the user needs the proposal text to copy-paste into Upwork.
- Acceptable preamble: one short line before the audit (e.g. "Scored 1 job — here's the audit:") then the raw 'audit' string. Nothing after.`;

// ─── Main orchestration loop ────────────────────────────────────────────────
export async function callModel(messages: ChatMessage[], maxTokens = 800, model = HF_MODEL_DEFAULT): Promise<string> {
  const hfToken = process.env.HF_API_TOKEN;
  if (!hfToken) throw new Error("HF_API_TOKEN not configured");
  const r = await fetch(HF_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${hfToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages,
    }),
  });
  const d = await r.json() as { choices?: Array<{ message: { content: string } }>; error?: unknown };
  if (d.error) {
    console.error("[orchestrator] HF error:", d.error);
    throw new Error(typeof d.error === "string" ? d.error : JSON.stringify(d.error));
  }
  // Qwen3 wraps internal reasoning in <think>...</think> blocks — strip before parsing
  const raw = d.choices?.[0]?.message?.content ?? "";
  return raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function extractToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
  // Find each `{` and try to parse balanced JSON starting there
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          try {
            const obj = JSON.parse(candidate);
            if (obj && typeof obj.tool === "string") {
              return { tool: obj.tool, args: (obj.args ?? {}) as Record<string, unknown> };
            }
          } catch { /* not JSON, keep scanning */ }
          break; // outer-loop continues to next `{`
        }
      }
    }
  }
  return null;
}

export interface OrchestratorResult {
  reply: string;
  toolCalls: Array<{ tool: string; args: unknown; result?: unknown; error?: string }>;
}

// Write-action tools that must not be accidentally double-fired
const WRITE_TOOLS = new Set([
  "delegate", "audit", "ig_render", "ig_approve", "ig_reject", "kanban_move",
  "schedule", "write_file", "vault_write", "client_create", "client_update",
  "notebooklm_add", "analyze_creative", "research", "discover", "make_deck",
  "generate_image", "synthesize_voice", "clip_video",
]);

// Tools whose output should be relayed VERBATIM to the user, not paraphrased.
// When one of these succeeds, the orchestration loop short-circuits with the
// raw formatted content as the reply (with an optional brief preamble).
// Map: tool name → field on result that contains the verbatim text.
const VERBATIM_TOOLS: Record<string, { field: string; preamble?: (result: Record<string, unknown>) => string }> = {
  audit_upwork: {
    field: "audit",
    preamble: (r) => {
      const n = r.jobs_in_feed;
      return typeof n === "number"
        ? `Scored ${n} job${n === 1 ? "" : "s"} — verbatim audit + proposal${n === 1 ? "" : "s"} below:\n\n`
        : "";
    },
  },
};
// Per-chat dedupe cache: chatId|tool|argsHash → timestamp
const recentWrites = new Map<string, number>();
const DEDUPE_MS = 5 * 60 * 1000; // 5 minutes

function dedupeKey(chatId: string, tool: string, args: unknown): string {
  return `${chatId}|${tool}|${JSON.stringify(args)}`;
}

export async function orchestrate(chatId: string, userMessage: string, model?: string): Promise<OrchestratorResult> {
  if (model && !HF_MODEL_IDS.has(model)) model = HF_MODEL_DEFAULT;
  saveTurn(chatId, "user", userMessage);
  const history = loadHistory(chatId);

  // Build conversation: system + history (already includes the just-saved user msg)
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
  ];

  const toolCalls: OrchestratorResult["toolCalls"] = [];
  let finalReply = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await callModel(messages, 800, model);
    const toolCall = extractToolCall(response);

    if (!toolCall) {
      finalReply = response;
      break;
    }

    // Execute tool (with dedupe guard on write actions)
    const def = TOOLS[toolCall.tool];
    let result: unknown;
    let error: string | undefined;
    if (!def) {
      error = `Unknown tool: ${toolCall.tool}`;
    } else if (WRITE_TOOLS.has(toolCall.tool)) {
      const key = dedupeKey(chatId, toolCall.tool, toolCall.args);
      const last = recentWrites.get(key);
      if (last && Date.now() - last < DEDUPE_MS) {
        result = { skipped: true, reason: "duplicate within 5 minutes — not re-executed" };
      } else {
        try {
          result = await def.handler(toolCall.args);
          recentWrites.set(key, Date.now());
        } catch (e) {
          error = (e as Error).message;
        }
      }
    } else {
      try {
        result = await def.handler(toolCall.args);
      } catch (e) {
        error = (e as Error).message;
      }
    }
    toolCalls.push({ tool: toolCall.tool, args: toolCall.args, result, error });

    // Verbatim short-circuit: some tools (e.g. audit_upwork) format their own
    // output for the user — relay it directly instead of letting the model
    // paraphrase and corrupt the proposal text.
    const verbatim = VERBATIM_TOOLS[toolCall.tool];
    if (!error && verbatim && result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const body = r[verbatim.field];
      if (typeof body === "string" && body.trim().length > 0) {
        const preamble = verbatim.preamble?.(r) ?? "";
        finalReply = preamble + body;
        break;
      }
    }

    // Feed the tool result back as a user-role observation (works across all providers)
    messages.push({ role: "assistant", content: response });
    messages.push({
      role: "user",
      content: `[TOOL RESULT] ${toolCall.tool} ${error ? `errored: ${error}` : `returned: ${JSON.stringify(result).slice(0, 2000)}`}\n\nUse this to answer the user's original question. If you have enough info, reply now as prose. If you need more tools, call another.`,
    });
  }

  if (!finalReply) {
    finalReply = "I hit the tool-call limit without finishing. Try breaking the request into smaller steps.";
  }

  saveTurn(chatId, "assistant", finalReply);
  return { reply: finalReply, toolCalls };
}

export function listTools(): Array<{ name: string; args: string; description: string }> {
  return Object.entries(TOOLS).map(([name, def]) => ({ name, args: def.args, description: def.description }));
}

// Fire a tool by name from outside the orchestration loop (used by the cron worker).
// Bypasses the dedupe guard — scheduled tasks are by definition intentional.
export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const def = TOOLS[name];
  if (!def) throw new Error(`Unknown tool: ${name}`);
  return await def.handler(args);
}
