import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "data.db");

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      instruction TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

export function enqueueTask(agent: string, instruction: string): number {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO agent_tasks (agent, instruction, status) VALUES (?, ?, 'queued')"
  );
  const result = stmt.run(agent, instruction);
  db.close();
  return result.lastInsertRowid as number;
}

export interface QueueStatus {
  queued: number;
  inProgress: number;
  completedToday: number;
}

export function getQueueStatus(): QueueStatus {
  const db = getDb();
  const queued = (db.prepare("SELECT COUNT(*) as n FROM agent_tasks WHERE status = 'queued'").get() as { n: number }).n;
  const inProgress = (db.prepare("SELECT COUNT(*) as n FROM agent_tasks WHERE status = 'in_progress'").get() as { n: number }).n;
  const completedToday = (db.prepare(
    "SELECT COUNT(*) as n FROM agent_tasks WHERE status = 'done' AND date(created_at) = date('now')"
  ).get() as { n: number }).n;
  db.close();
  return { queued, inProgress, completedToday };
}

export interface AgentTask {
  id: number;
  agent: string;
  instruction: string;
  status: string;
  result: string | null;
  created_at: string;
}

export function getRecentTasks(limit = 20): AgentTask[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM agent_tasks ORDER BY id DESC LIMIT ?"
  ).all(limit) as AgentTask[];
  db.close();
  return rows;
}

export function updateTaskStatus(id: number, status: string, result?: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE agent_tasks SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, result ?? null, id);
  db.close();
}
