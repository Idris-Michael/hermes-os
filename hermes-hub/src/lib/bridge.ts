/**
 * bridge.ts — Unified external tool entry point for Hermes OS agents.
 *
 * All agent calls to n8n, Obsidian, Kanban, Telegram, HuggingFace, Instagram
 * go through bridge.execute(). Never build per-agent fetch logic elsewhere.
 *
 * Idempotency: tickets are locked on pickup (status → "processing") and moved
 * to "completed" or "failed" on exit. An audit_log entry is appended for every call.
 */

import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// ─── Audit log ────────────────────────────────────────────────────────────────

const AUDIT_LOG = path.resolve(process.cwd(), "logs", "bridge-audit.jsonl");

function auditLog(
  tool: string,
  job_id: string,
  ok: boolean,
  error?: string
): void {
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG), { recursive: true });
    fs.appendFileSync(
      AUDIT_LOG,
      JSON.stringify({ ts: new Date().toISOString(), tool, job_id, ok, error }) + "\n"
    );
  } catch {
    // Never let logging kill the caller
  }
}

// ─── Payload schemas ──────────────────────────────────────────────────────────

// Typed schema map — keep as const so inferred types are preserved
const schemas = {
  n8n: z.object({
    workflow_id: z.string().min(1),
    data: z.record(z.string(), z.unknown()).default({}),
  }),
  obsidian: z.discriminatedUnion("action", [
    z.object({ action: z.literal("read"), path: z.string().min(1) }),
    z.object({
      action: z.literal("write"),
      path: z.string().min(1),
      content: z.string(),
    }),
    z.object({
      action: z.literal("append"),
      path: z.string().min(1),
      content: z.string(),
    }),
  ]),
  kanban: z.object({
    action: z.enum(["delegate", "version"]),
    payload: z.object({
      title: z.string().min(1),
      assignee: z.string().min(1),
      priority: z.enum(["high", "medium", "low"]).default("medium"),
      intent: z.string().optional(),
    }).optional(),
  }),
  telegram: z.object({
    text: z.string().min(1),
    chat_id: z.string().optional(),
  }),
  hf: z.object({
    model: z.string().min(1),
    messages: z.array(z.object({ role: z.string(), content: z.string() })),
    max_tokens: z.number().int().positive().default(1024),
  }),
  instagram: z.object({
    action: z.enum(["publish", "status"]),
    media_url: z.string().url().optional(),
    caption: z.string().optional(),
    ig_user_id: z.string().optional(),
  }),
};

// ─── Result type ──────────────────────────────────────────────────────────────

export interface BridgeResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  job_id: string;
}

// ─── Tool implementations ─────────────────────────────────────────────────────

async function _n8n(
  payload: z.infer<typeof schemas.n8n>,
  job_id: string
): Promise<BridgeResult> {
  const base = process.env.N8N_BASE_URL;
  if (!base) return { ok: false, error: "N8N_BASE_URL not set", job_id };
  try {
    const res = await fetch(`${base}/webhook/${payload.workflow_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.data),
    });
    return res.ok
      ? { ok: true, data: await res.json(), job_id }
      : { ok: false, error: `n8n HTTP ${res.status}`, job_id };
  } catch (e) {
    return { ok: false, error: String(e), job_id };
  }
}

async function _obsidian(
  payload: z.infer<typeof schemas.obsidian>,
  job_id: string
): Promise<BridgeResult> {
  const key = process.env.OBSIDIAN_API_KEY;
  if (!key) return { ok: false, error: "OBSIDIAN_API_KEY not set", job_id };
  // OBSIDIAN_API_URL wins if set (use host.docker.internal when called from inside Docker/n8n).
  // Falls back to localhost for direct hermes-hub server calls.
  const base = process.env.OBSIDIAN_API_URL
    ?? `http://localhost:${process.env.OBSIDIAN_API_PORT ?? "27123"}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  try {
    if (payload.action === "read") {
      const r = await fetch(`${base}/vault/${encodeURIComponent(payload.path)}`, { headers });
      return { ok: r.ok, data: await r.text(), job_id };
    }
    if (payload.action === "write") {
      const r = await fetch(`${base}/vault/${encodeURIComponent(payload.path)}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "text/markdown" },
        body: payload.content,
      });
      return { ok: r.ok, job_id };
    }
    if (payload.action === "append") {
      // Read → concat → write
      const rGet = await fetch(`${base}/vault/${encodeURIComponent(payload.path)}`, { headers });
      const existing = rGet.ok ? await rGet.text() : "";
      const merged = existing + "\n" + payload.content;
      const rPut = await fetch(`${base}/vault/${encodeURIComponent(payload.path)}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "text/markdown" },
        body: merged,
      });
      return { ok: rPut.ok, job_id };
    }
    return { ok: false, error: "Unknown obsidian action", job_id };
  } catch (e) {
    return { ok: false, error: String(e), job_id };
  }
}

async function _kanban(
  payload: z.infer<typeof schemas.kanban>,
  job_id: string
): Promise<BridgeResult> {
  const base = `http://localhost:${process.env.HUB_PORT ?? "3000"}`;
  try {
    if (payload.action === "version") {
      const r = await fetch(`${base}/api/kanban/version`);
      return { ok: r.ok, data: await r.json(), job_id };
    }
    if (payload.action === "delegate" && payload.payload) {
      const r = await fetch(`${base}/api/kanban/delegate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.payload),
      });
      return { ok: r.ok, data: await r.json(), job_id };
    }
    return { ok: false, error: "Missing payload for delegate", job_id };
  } catch (e) {
    return { ok: false, error: String(e), job_id };
  }
}

async function _telegram(
  payload: z.infer<typeof schemas.telegram>,
  job_id: string
): Promise<BridgeResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set", job_id };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.chat_id ?? process.env.TELEGRAM_CHAT_ID,
        text: payload.text,
      }),
    });
    return { ok: r.ok, data: await r.json(), job_id };
  } catch (e) {
    return { ok: false, error: String(e), job_id };
  }
}

async function _hf(
  payload: z.infer<typeof schemas.hf>,
  job_id: string
): Promise<BridgeResult> {
  const token = process.env.HF_API_TOKEN;
  if (!token) return { ok: false, error: "HF_API_TOKEN not set", job_id };
  try {
    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: payload.model,
        messages: payload.messages,
        max_tokens: payload.max_tokens,
      }),
    });
    return { ok: r.ok, data: await r.json(), job_id };
  } catch (e) {
    return { ok: false, error: String(e), job_id };
  }
}

async function _instagram(
  payload: z.infer<typeof schemas.instagram>,
  job_id: string
): Promise<BridgeResult> {
  const token = process.env.META_IG_TOKEN;
  if (!token) return { ok: false, error: "META_IG_TOKEN not set", job_id };
  const ig_user_id = payload.ig_user_id ?? process.env.IG_BUSINESS_ID_SEVERUS;
  try {
    if (payload.action === "publish" && payload.media_url) {
      const create = await fetch(
        `https://graph.facebook.com/v19.0/${ig_user_id}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "REELS",
            video_url: payload.media_url,
            caption: payload.caption ?? "",
            access_token: token,
          }),
        }
      );
      if (!create.ok) return { ok: false, error: `media create HTTP ${create.status}`, job_id };
      const { id: creation_id } = await create.json() as { id: string };
      const pub = await fetch(
        `https://graph.facebook.com/v19.0/${ig_user_id}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id, access_token: token }),
        }
      );
      return { ok: pub.ok, data: await pub.json(), job_id };
    }
    return { ok: false, error: "Unsupported instagram action", job_id };
  } catch (e) {
    return { ok: false, error: String(e), job_id };
  }
}

// ─── Public execute ───────────────────────────────────────────────────────────

type Tool = keyof typeof schemas;

export async function bridgeExecute<T = unknown>(
  tool: Tool,
  payload: unknown,
  options: { job_id?: string } = {}
): Promise<BridgeResult<T>> {
  const job_id = options.job_id ?? uuidv4();

  // 1. Schema validation
  const schema = schemas[tool];
  if (!schema) {
    const r = { ok: false, error: `Unknown tool: ${tool}`, job_id };
    auditLog(tool, job_id, false, r.error);
    return r as BridgeResult<T>;
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const err = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    const r = { ok: false, error: `Validation: ${err}`, job_id };
    auditLog(tool, job_id, false, r.error);
    return r as BridgeResult<T>;
  }

  // 2. Dispatch
  let result: BridgeResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = parsed.data as any;
  switch (tool) {
    case "n8n":         result = await _n8n(p, job_id);       break;
    case "obsidian":    result = await _obsidian(p, job_id);   break;
    case "kanban":      result = await _kanban(p, job_id);     break;
    case "telegram":    result = await _telegram(p, job_id);   break;
    case "hf":          result = await _hf(p, job_id);         break;
    case "instagram":   result = await _instagram(p, job_id);  break;
    default:            result = { ok: false, error: `No handler: ${tool}`, job_id };
  }

  auditLog(tool, job_id, result.ok, result.error);
  return result as BridgeResult<T>;
}

// ─── Ticket helpers ───────────────────────────────────────────────────────────

const ACTIVE_TASKS_DIR = path.resolve(
  process.env.OBSIDIAN_VAULT_PATH ?? "C:/Users/profs/Desktop/Sandbox",
  "Hermes OS/06 Memory/Active_Tasks"
);

export interface JobTicket {
  task_id: string;
  job_id: string;
  created_at: string;
  originator: string;
  recipient: string;
  priority: "high" | "medium" | "low";
  skill_required: string;
  payload: {
    brief: string;
    brand?: string;
    assets?: string[];
    constraints?: Record<string, unknown>;
  };
  context_ref: string;
  status: "pending" | "processing" | "completed" | "failed";
  output: unknown;
  completed_at: string | null;
}

/**
 * Claim a pending ticket (lock it). Returns null if already taken.
 * Moves the file to .processing to act as a filesystem semaphore.
 */
export function claimTicket(task_id: string): JobTicket | null {
  const src = path.join(ACTIVE_TASKS_DIR, `${task_id}.md`);
  const lock = path.join(ACTIVE_TASKS_DIR, `${task_id}.processing`);
  if (!fs.existsSync(src) || fs.existsSync(lock)) return null;
  try {
    const raw = fs.readFileSync(src, "utf-8");
    // Extract JSON block from markdown
    const match = raw.match(/```json\n([\s\S]*?)```/);
    if (!match) return null;
    const ticket = JSON.parse(match[1]) as JobTicket;
    if (ticket.status !== "pending") return null;
    // Lock: rename to .processing
    fs.renameSync(src, lock);
    return ticket;
  } catch {
    return null;
  }
}

/** Mark a claimed ticket as completed or failed. Writes to processed/ subfolder. */
export function resolveTicket(
  task_id: string,
  status: "completed" | "failed",
  output: unknown
): void {
  const lock = path.join(ACTIVE_TASKS_DIR, `${task_id}.processing`);
  const processedDir = path.join(ACTIVE_TASKS_DIR, "processed");
  fs.mkdirSync(processedDir, { recursive: true });
  if (!fs.existsSync(lock)) return;
  try {
    const raw = fs.readFileSync(lock, "utf-8");
    const match = raw.match(/```json\n([\s\S]*?)```/);
    if (!match) { fs.unlinkSync(lock); return; }
    const ticket = JSON.parse(match[1]) as JobTicket;
    ticket.status = status;
    ticket.output = output;
    ticket.completed_at = new Date().toISOString();
    const updated = raw.replace(
      /```json\n[\s\S]*?```/,
      "```json\n" + JSON.stringify(ticket, null, 2) + "\n```"
    );
    fs.writeFileSync(path.join(processedDir, `${task_id}.md`), updated, "utf-8");
    fs.unlinkSync(lock);
  } catch {
    // Leave the .processing file in place — safer than silent delete
  }
}
