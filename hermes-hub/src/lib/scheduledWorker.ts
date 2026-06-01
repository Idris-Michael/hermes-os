// Scheduled tasks worker.
// Polls the scheduled_tasks SQLite table every 30s. For each row where
// status='pending' AND run_at <= now: fire the named orchestrator tool with
// stored args, mark done (or reschedule if recurring), optionally notify a
// Telegram chat with the result.

import path from "node:path";
import Database from "better-sqlite3";
import { executeTool, nextRecurrence } from "./orchestrator.js";

const dbPath = path.join(process.cwd(), "data.db");
const db = new Database(dbPath);

const POLL_INTERVAL_MS = 30_000;
const PER_TICK_CAP = 10; // never fire more than 10 due tasks in one tick

interface ScheduledRow {
  id: number;
  run_at: number;
  tool: string;
  args: string;
  recurrence: string | null;
  notify_chat_id: string | null;
}

function pickDue(now: number): ScheduledRow[] {
  return db.prepare(
    `SELECT id, run_at, tool, args, recurrence, notify_chat_id
     FROM scheduled_tasks
     WHERE status = 'pending' AND run_at <= ?
     ORDER BY run_at ASC
     LIMIT ?`
  ).all(now, PER_TICK_CAP) as ScheduledRow[];
}

function markDone(id: number, fired: number): void {
  db.prepare("UPDATE scheduled_tasks SET status = 'done', last_fired_at = ?, last_error = NULL WHERE id = ?").run(fired, id);
}

function markErrored(id: number, message: string, fired: number): void {
  db.prepare("UPDATE scheduled_tasks SET status = 'errored', last_error = ?, last_fired_at = ? WHERE id = ?")
    .run(message.slice(0, 500), fired, id);
}

function reschedule(id: number, nextRunAt: number, fired: number): void {
  db.prepare("UPDATE scheduled_tasks SET status = 'pending', run_at = ?, last_fired_at = ?, last_error = NULL WHERE id = ?")
    .run(nextRunAt, fired, id);
}

async function notifyTelegram(chatId: string, text: string): Promise<void> {
  try {
    const { sendMessage } = await import("./telegramGateway.js");
    await sendMessage(text, chatId);
  } catch (e) {
    console.error(`[scheduled-worker] telegram notify failed: ${(e as Error).message}`);
  }
}

function summarizeResult(result: unknown): string {
  if (result === null || result === undefined) return "(no output)";
  if (typeof result === "string") return result.slice(0, 1500);
  try {
    const s = JSON.stringify(result, null, 2);
    return s.length > 1500 ? s.slice(0, 1500) + "…" : s;
  } catch {
    return String(result).slice(0, 1500);
  }
}

async function fireOne(row: ScheduledRow): Promise<void> {
  const now = Date.now();
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(row.args); } catch { /* keep empty */ }

  console.log(`[scheduled-worker] firing #${row.id} tool=${row.tool} (recurring=${row.recurrence ?? "no"})`);

  try {
    const result = await executeTool(row.tool, args);

    if (row.recurrence) {
      const next = nextRecurrence(row.recurrence, now);
      reschedule(row.id, next, now);
      console.log(`[scheduled-worker] #${row.id} done, next run ${new Date(next).toISOString()}`);
    } else {
      markDone(row.id, now);
    }

    if (row.notify_chat_id) {
      await notifyTelegram(
        row.notify_chat_id,
        `<i>⏰ Scheduled #${row.id}: ${row.tool}</i>\n\n${summarizeResult(result)}`
      );
    }
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error(`[scheduled-worker] #${row.id} errored: ${msg}`);
    // Recurring tasks: still reschedule so transient failures don't kill the recurrence
    if (row.recurrence) {
      const next = nextRecurrence(row.recurrence, now);
      reschedule(row.id, next, now);
      db.prepare("UPDATE scheduled_tasks SET last_error = ? WHERE id = ?").run(msg.slice(0, 500), row.id);
    } else {
      markErrored(row.id, msg, now);
    }
    if (row.notify_chat_id) {
      await notifyTelegram(row.notify_chat_id, `⚠️ Scheduled #${row.id} (${row.tool}) errored: ${msg.slice(0, 300)}`);
    }
  }
}

async function tick(): Promise<void> {
  const due = pickDue(Date.now());
  if (due.length === 0) return;
  // Serial execution — keeps SQLite happy, predictable load
  for (const row of due) {
    await fireOne(row);
  }
}

let started = false;
let intervalHandle: NodeJS.Timeout | null = null;

export function startScheduledWorker(): void {
  if (started) return;
  started = true;
  // First tick after a short delay so server has fully bound
  setTimeout(() => {
    tick().catch((e) => console.error(`[scheduled-worker] initial tick failed: ${(e as Error).message}`));
  }, 5_000);
  intervalHandle = setInterval(() => {
    tick().catch((e) => console.error(`[scheduled-worker] tick failed: ${(e as Error).message}`));
  }, POLL_INTERVAL_MS);
  console.log(`[scheduled-worker] started — polling every ${POLL_INTERVAL_MS / 1000}s`);
}

export function stopScheduledWorker(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  started = false;
}
