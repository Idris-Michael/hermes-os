import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename_init = fileURLToPath(import.meta.url);
const __dirname_init = path.dirname(__filename_init);
// Absolute env paths — survive any working directory
const envLoaded = dotenv.config({ path: path.join(__dirname_init, ".env.local") });
dotenv.config({ path: path.join(__dirname_init, ".env") });
if (envLoaded.error && !process.env.TELEGRAM_BOT_TOKEN) {
  console.error("[FATAL] .env.local not loaded and TELEGRAM_BOT_TOKEN missing. Exiting.");
  process.exit(1);
}
import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import Database from "better-sqlite3";
import { dispatchUpdate, validateWebhookSecret, startPolling, sendMessage, getPollingHealth } from "./src/lib/telegramGateway.js";
import { getRecentTasks } from "./src/lib/jobQueue.js";
import { orchestrate, clearHistory, listTools, callModel, listConversations, loadFullHistory } from "./src/lib/orchestrator.js";
import { PANTHEON } from "./src/lib/pantheonRegistry.js";
import { startUpworkCron } from "./src/lib/upworkFeed.js";
import { startScheduledWorker } from "./src/lib/scheduledWorker.js";

const __dirname = __dirname_init;

const PROFILES_DIR = "C:/Users/profs/AppData/Local/hermes/profiles";
const KANBAN_PATH = path.join(__dirname, "data", "kanban.json");

let kanbanVersion = 1;

const KANBAN_COLUMNS = ["BACKLOG", "TO DO", "IN PROGRESS", "REVIEW", "DONE"] as const;

interface DelegationInput {
  title: string;
  assignee: string;
  priority: "high" | "medium" | "low";
  column: string;
  chatId?: string;
  intent?: string;
}

interface DelegatedCard {
  id: string;
  title: string;
  assignee: string;
  priority: "high" | "medium" | "low";
  chatId?: string;
  intent?: string;
  createdAt: number;
}

function readKanbanFile(): { columns: Record<string, DelegatedCard[]> } {
  if (!fs.existsSync(KANBAN_PATH)) {
    const empty: Record<string, DelegatedCard[]> = {};
    for (const c of KANBAN_COLUMNS) empty[c] = [];
    return { columns: empty };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(KANBAN_PATH, "utf-8"));
    if (parsed && typeof parsed === "object" && parsed.columns) return parsed;
  } catch { /* fall through */ }
  const empty: Record<string, DelegatedCard[]> = {};
  for (const c of KANBAN_COLUMNS) empty[c] = [];
  return { columns: empty };
}

function delegateCard(input: DelegationInput): DelegatedCard {
  const board = readKanbanFile();
  const targetCol = KANBAN_COLUMNS.includes(input.column as typeof KANBAN_COLUMNS[number])
    ? input.column
    : "TO DO";
  for (const c of KANBAN_COLUMNS) if (!Array.isArray(board.columns[c])) board.columns[c] = [];

  const trimmed = input.title.replace(/\s+/g, " ").trim();
  const card: DelegatedCard = {
    id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: trimmed.length > 140 ? trimmed.slice(0, 137) + "…" : trimmed,
    assignee: input.assignee,
    priority: input.priority,
    chatId: input.chatId,
    intent: input.intent,
    createdAt: Date.now(),
  };
  board.columns[targetCol] = [...(board.columns[targetCol] ?? []), card];
  atomicWriteFileSync(KANBAN_PATH, JSON.stringify(board, null, 2));
  kanbanVersion++;
  return card;
}

const INTENT_TO_DELEGATION: Record<string, { assignee: string; column: string; priority: "high" | "medium" | "low" }> = {
  RENDER:         { assignee: "H-A", column: "TO DO",   priority: "high" },
  COPYWRITE:      { assignee: "H-K", column: "TO DO",   priority: "high" },
  VISION_ANALYZE: { assignee: "H-Q", column: "TO DO",   priority: "medium" },
  ANALYTICS:      { assignee: "C-K", column: "TO DO",   priority: "medium" },
  VAULT:          { assignee: "S-A", column: "BACKLOG", priority: "low" },
};
const CLIENTS_PATH = path.join(__dirname, "data", "clients.json");
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT || "C:/Users/profs/Desktop/Sandbox";
const HERMES_PORT = 8642;

const swarmTaskStore = new Map<string, { id: string; agent: string; brief: string; status: string; output: string }>();
const swarmTaskTimestamps = new Map<string, number>();
const SWARM_TASK_TTL_MS = 24 * 60 * 60 * 1000;
const SWARM_TASK_MAX = 500;

function setSwarmTask(id: string, task: { id: string; agent: string; brief: string; status: string; output: string }) {
  swarmTaskStore.set(id, task);
  swarmTaskTimestamps.set(id, Date.now());
  if (swarmTaskStore.size > SWARM_TASK_MAX) {
    const oldestId = [...swarmTaskTimestamps.entries()].sort((a, b) => a[1] - b[1])[0]?.[0];
    if (oldestId) { swarmTaskStore.delete(oldestId); swarmTaskTimestamps.delete(oldestId); }
  }
}

setInterval(() => {
  const cutoff = Date.now() - SWARM_TASK_TTL_MS;
  for (const [id, ts] of swarmTaskTimestamps) {
    if (ts < cutoff) { swarmTaskStore.delete(id); swarmTaskTimestamps.delete(id); }
  }
}, 60 * 60 * 1000).unref();

let swarmProcess: ChildProcess | null = null;
let openclawProcess: ChildProcess | null = null;
const swarmLogBuffer: string[] = [];
const openclawLogBuffer: string[] = [];
const MAX_LOG_LINES = 200;

function appendSwarmLog(line: string) {
  swarmLogBuffer.push(line);
  if (swarmLogBuffer.length > MAX_LOG_LINES) swarmLogBuffer.shift();
}
function appendOpenclawLog(line: string) {
  openclawLogBuffer.push(line);
  if (openclawLogBuffer.length > MAX_LOG_LINES) openclawLogBuffer.shift();
}

function atomicWriteFileSync(filePath: string, data: string | Buffer) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

function parseYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split("\n");
  let inModel = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "model:") { inModel = true; continue; }
    if (inModel && !line.startsWith(" ") && !line.startsWith("\t") && trimmed !== "") { inModel = false; }
    if (inModel) {
      const match = trimmed.match(/^(\w[\w_]+):\s*"?([^"#\n]*)"?\s*$/);
      if (match) result[match[1]] = match[2].trim();
    }
  }
  return result;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) result[kv[1].trim()] = kv[2].trim();
  }
  return result;
}

function getTier(baseUrl: string, model: string): string {
  if (baseUrl.includes("cerebras.ai")) return "Cerebras";
  if (baseUrl.includes("deepseek.com")) return "DeepSeek";
  if (baseUrl.includes("openrouter.ai")) return "OpenRouter";
  if (model.includes("claude") || baseUrl.includes("anthropic")) return "Claude";
  return "Local";
}

function walkDir(dir: string, ext: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) walkDir(full, ext, results);
      else if (entry.isFile() && entry.name.endsWith(ext)) results.push(full);
    }
  } catch { /* skip permission errors */ }
  return results;
}

async function startServer() {
  const app = express();
  app.use(compression());
  app.use(express.json());
  app.use("/static", express.static(path.join(__dirname, "public", "static")));

  // ─── Health ───────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    const poll = getPollingHealth();
    const pollAge = poll.lastPollAt ? Math.floor((Date.now() - poll.lastPollAt) / 1000) : -1;
    const healthy = poll.active && pollAge < 60;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      uptime: Math.floor(process.uptime()),
      telegram: { active: poll.active, lastPollAgo: pollAge, errors: poll.errors },
    });
  });

  // ─── Telegram gateway ─────────────────────────────────────────────────────
  app.post("/telegram/webhook", async (req, res) => {
    const secret = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;
    if (!validateWebhookSecret(secret)) { res.status(401).json({ error: "unauthorized" }); return; }
    res.sendStatus(200);
    dispatchUpdate(req.body).catch((err) => console.error("[telegram] dispatch error:", err));
  });

  // ─── Agent task queue ─────────────────────────────────────────────────────
  app.get("/api/tasks", (_req, res) => res.json(getRecentTasks()));

  // ─── Hermes Hub in-app Telegram console ───────────────────────────────────
  // POST { chat_id, text } → routes through the same dispatcher as Telegram
  app.post("/api/telegram/dispatch", async (req, res) => {
    const { chat_id, text } = req.body ?? {};
    if (!chat_id || !text) { res.status(400).json({ error: "chat_id and text required" }); return; }
    try {
      await dispatchUpdate({
        message: {
          chat: { id: Number(chat_id), type: "private" },
          text: String(text),
          from: { id: Number(chat_id) },
        },
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  // Lets the hub UI push a free-text message back to a Telegram chat
  app.post("/api/telegram/send", async (req, res) => {
    const { chat_id, text } = req.body ?? {};
    if (!chat_id || !text) { res.status(400).json({ error: "chat_id and text required" }); return; }
    try {
      await sendMessage(String(text), String(chat_id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ─── Flights ──────────────────────────────────────────────────────────────
  app.get("/api/flights", async (_req, res) => {
    try {
      const r = await fetch("https://opensky-network.org/api/states/all?lamin=51.2&lomin=-0.6&lamax=51.8&lomax=0.4");
      res.json(await r.json());
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Tube ─────────────────────────────────────────────────────────────────
  app.get("/api/tube", async (_req, res) => {
    try {
      const r = await fetch("https://api.tfl.gov.uk/Line/Mode/tube,dlr,overground,elizabeth-line/Status");
      res.json(await r.json());
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.get("/api/disruptions", async (_req, res) => {
    try {
      const r = await fetch("https://api.tfl.gov.uk/Road/all/Disruption");
      res.json(await r.json());
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.get("/api/cams", async (_req, res) => {
    try {
      const r = await fetch("https://api.tfl.gov.uk/Place/Type/JamCam");
      res.json(await r.json());
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Polymarket ───────────────────────────────────────────────────────────
  app.get("/api/polymarket", async (req, res) => {
    try {
      const { tag } = req.query as { tag?: string };
      const base = "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=24&order=volume&ascending=false";
      const url = tag ? `${base}&tag=${encodeURIComponent(tag)}` : base;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Polymarket ${r.status}`);
      const data = await r.json() as Record<string, unknown>[];
      res.json(data.map((m) => ({
        id: m.id, question: m.question, slug: m.slug, endDate: m.endDate,
        volume: m.volume, liquidity: m.liquidity, outcomes: m.outcomes,
        outcomePrices: m.outcomePrices, image: m.image, featured: m.featured, new: m.new,
      })));
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Swarm ────────────────────────────────────────────────────────────────
  app.get("/api/swarm/tasks", (_req, res) => {
    res.json([...swarmTaskStore.values()].slice(-20).reverse());
  });

  app.post("/api/swarm/task", async (req, res) => {
    const { task } = req.body as { task?: string };
    if (!task) return res.status(400).json({ error: "task required" });

    const match = String(task).match(/^\[@([^\]]+)\]\s*([\s\S]*)/);
    const agentId = match?.[1] ?? "jack-of-spades";
    const brief = match?.[2]?.trim() ?? String(task);

    const entry = PANTHEON[agentId];
    if (!entry) return res.status(400).json({ error: `Unknown agent: ${agentId}` });

    const agentPrompt = fs.readFileSync(entry.file, "utf8");
    const taskId = Date.now().toString();
    setSwarmTask(taskId, { id: taskId, agent: agentId, brief, status: "in_progress", output: "" });
    appendSwarmLog(`[${agentId}] started: ${brief.slice(0, 80)}`);

    (async () => {
      try {
        const messages = [
          { role: "system" as const, content: agentPrompt },
          { role: "user" as const, content: brief },
        ];
        const output = await callModel(messages, 1200, entry.model);
        setSwarmTask(taskId, { id: taskId, agent: agentId, brief, status: "done", output });
        appendSwarmLog(`[${agentId}] done`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSwarmTask(taskId, { id: taskId, agent: agentId, brief, status: "error", output: msg });
        appendSwarmLog(`[${agentId}] error: ${msg}`);
      }
    })();

    res.json({ ok: true, taskId, agent: agentId });
  });

  app.post("/api/swarm/control", (req, res) => {
    const { action } = req.body as { action?: string };
    if (action === "start") {
      if (swarmProcess) return res.json({ ok: true, message: "already running", pid: swarmProcess.pid });
      swarmProcess = spawn("openswarm", ["start"], { shell: true });
      swarmProcess.stdout?.on("data", (d: Buffer) => appendSwarmLog(d.toString().trim()));
      swarmProcess.stderr?.on("data", (d: Buffer) => appendSwarmLog(d.toString().trim()));
      swarmProcess.on("close", (code) => { appendSwarmLog(`[exited: ${code}]`); swarmProcess = null; });
      res.json({ ok: true, pid: swarmProcess.pid });
    } else if (action === "stop") {
      swarmProcess?.kill(); swarmProcess = null;
      res.json({ ok: true });
    } else res.status(400).json({ error: "action must be start or stop" });
  });

  app.get("/api/swarm/logs", (_req, res) => res.json({ lines: swarmLogBuffer.slice(-20), running: swarmProcess !== null }));

  // ─── Agents ───────────────────────────────────────────────────────────────
  app.get("/api/agents", (_req, res) => {
    try {
      if (!fs.existsSync(PROFILES_DIR)) return res.json([]);
      const dirs = fs.readdirSync(PROFILES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
      const agents = dirs.map((slug) => {
        const configPath = path.join(PROFILES_DIR, slug, "config.yaml");
        let model = "unknown", provider = "unknown", base_url = "", tier = "Local";
        if (fs.existsSync(configPath)) {
          const parsed = parseYaml(fs.readFileSync(configPath, "utf-8"));
          model = parsed.default || "unknown";
          provider = parsed.provider || "unknown";
          base_url = parsed.base_url || "";
          tier = getTier(base_url, model);
        }
        return { slug, model, provider, base_url, tier };
      });
      res.json(agents);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Clients (CRM) ────────────────────────────────────────────────────────
  app.get("/api/clients", (_req, res) => {
    try {
      if (!fs.existsSync(CLIENTS_PATH)) return res.json([]);
      res.json(JSON.parse(fs.readFileSync(CLIENTS_PATH, "utf-8")));
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post("/api/clients", (req, res) => {
    try {
      const clients = fs.existsSync(CLIENTS_PATH) ? JSON.parse(fs.readFileSync(CLIENTS_PATH, "utf-8")) : [];
      const newClient = { id: `c${Date.now()}`, addedAt: new Date().toISOString().split("T")[0], ...req.body };
      clients.push(newClient);
      atomicWriteFileSync(CLIENTS_PATH, JSON.stringify(clients, null, 2));
      res.json(newClient);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.patch("/api/clients/:id", (req, res) => {
    try {
      const clients = JSON.parse(fs.readFileSync(CLIENTS_PATH, "utf-8"));
      const idx = clients.findIndex((c: { id: string }) => c.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: "Not found" });
      clients[idx] = { ...clients[idx], ...req.body };
      atomicWriteFileSync(CLIENTS_PATH, JSON.stringify(clients, null, 2));
      res.json(clients[idx]);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Kanban ───────────────────────────────────────────────────────────────
  app.get("/api/kanban", (_req, res) => {
    try {
      if (!fs.existsSync(KANBAN_PATH)) {
        const empty = { columns: { BACKLOG: [], "TO DO": [], "IN PROGRESS": [], REVIEW: [], DONE: [] } };
        atomicWriteFileSync(KANBAN_PATH, JSON.stringify(empty, null, 2));
        return res.json(empty);
      }
      res.json(JSON.parse(fs.readFileSync(KANBAN_PATH, "utf-8")));
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.put("/api/kanban", (req, res) => {
    try {
      atomicWriteFileSync(KANBAN_PATH, JSON.stringify(req.body, null, 2));
      kanbanVersion++;
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.get("/api/kanban/version", (_req, res) => {
    res.json({ v: kanbanVersion });
  });

  app.post("/api/kanban/delegate", (req, res) => {
    try {
      const { title, assignee, priority, column, chatId, intent } = req.body ?? {};
      if (!title || typeof title !== "string") {
        res.status(400).json({ error: "title required" });
        return;
      }
      const card = delegateCard({
        title: String(title),
        assignee: String(assignee ?? "unassigned"),
        priority: (priority === "high" || priority === "low") ? priority : "medium",
        column: typeof column === "string" ? column : "TO DO",
        chatId: chatId ? String(chatId) : undefined,
        intent: intent ? String(intent) : undefined,
      });
      res.json({ ok: true, card });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Memory graph ─────────────────────────────────────────────────────────
  app.get("/api/memory", (_req, res) => {
    try {
      const nodes: { id: string; name: string; type: string; description: string; path: string; mtime: number }[] = [];
      const CLAUDE_ROOT = "C:/Users/profs/.claude";

      // 1. Memory core node
      nodes.push({ id: "memory-core", name: "Memory Core", type: "memory core", description: "root", path: CLAUDE_ROOT, mtime: Date.now() });

      // 2. All project memory files (all projects, not just Hermes)
      const projectsDir = path.join(CLAUDE_ROOT, "projects");
      if (fs.existsSync(projectsDir)) {
        for (const proj of fs.readdirSync(projectsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
          const memDir = path.join(projectsDir, proj.name, "memory");
          if (!fs.existsSync(memDir)) continue;
          for (const file of fs.readdirSync(memDir).filter(f => f.endsWith(".md") && f !== "MEMORY.md")) {
            try {
              const filePath = path.join(memDir, file);
              const content = fs.readFileSync(filePath, "utf-8");
              const fm = parseFrontmatter(content);
              const stat = fs.statSync(filePath);
              nodes.push({
                id: `mem-${proj.name}-${file}`,
                name: fm.name || file.replace(".md", ""),
                type: fm.type || "reference",
                description: proj.name,
                path: filePath,
                mtime: stat.mtimeMs,
              });
            } catch { /* skip */ }
          }
        }
      }

      // 3. Agents (~28 agent definition files)
      const agentsDir = path.join(CLAUDE_ROOT, "agents");
      if (fs.existsSync(agentsDir)) {
        for (const file of fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"))) {
          try {
            const filePath = path.join(agentsDir, file);
            const stat = fs.statSync(filePath);
            nodes.push({ id: `agent-${file}`, name: file.replace(".md", ""), type: "sessions", description: "agent", path: filePath, mtime: stat.mtimeMs });
          } catch { /* skip */ }
        }
      }

      // 4. Skills (each skill dir = one node)
      const skillsDir = path.join(CLAUDE_ROOT, "skills");
      if (fs.existsSync(skillsDir)) {
        for (const dir of fs.readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
          try {
            const skillPath = path.join(skillsDir, dir.name);
            const stat = fs.statSync(skillPath);
            nodes.push({ id: `skill-${dir.name}`, name: dir.name, type: "skills", description: "skill", path: skillPath, mtime: stat.mtimeMs });
          } catch { /* skip */ }
        }
      }

      // 5. Plans
      const plansDir = path.join(CLAUDE_ROOT, "plans");
      if (fs.existsSync(plansDir)) {
        for (const file of fs.readdirSync(plansDir).filter(f => f.endsWith(".md"))) {
          try {
            const filePath = path.join(plansDir, file);
            const stat = fs.statSync(filePath);
            nodes.push({ id: `plan-${file}`, name: file.replace(".md", "").slice(0, 30), type: "decisions", description: "plan", path: filePath, mtime: stat.mtimeMs });
          } catch { /* skip */ }
        }
      }

      // 6. Obsidian vault
      const obsidianFiles = walkDir(OBSIDIAN_VAULT, ".md").slice(0, 50);
      for (const filePath of obsidianFiles) {
        try {
          const stat = fs.statSync(filePath);
          const rel = path.relative(OBSIDIAN_VAULT, filePath);
          const type = "obsidian";
          nodes.push({ id: `obs-${rel.replace(/\\/g, "/")}`, name: path.basename(filePath, ".md"), type, description: `Obsidian · ${rel.replace(/\\/g, "/")}`, path: filePath, mtime: stat.mtimeMs });
        } catch { /* skip */ }
      }

      // Latest signals = 8 most recently modified
      const signals = [...nodes].sort((a, b) => b.mtime - a.mtime).slice(0, 8).map(n => ({
        name: path.basename(n.path),
        mtime: n.mtime,
        ago: Math.round((Date.now() - n.mtime) / 3600000) + "h ago",
      }));

      const stale = nodes.filter(n => n.type === "stale").length;
      const missing = nodes.filter(n => n.type === "missing").length;

      res.json({ nodes, signals, stats: { total: nodes.length, stale, missing } });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Constellation graph ──────────────────────────────────────────────────
  app.get("/api/constellation", (_req, res) => {
    try {
      const filePath = path.join(OBSIDIAN_VAULT, "Hermes OS", "03 - SYSTEM", "constellation.json");
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        res.json(JSON.parse(content));
      } else {
        res.status(404).json({ error: "constellation.json not found" });
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Profiles ─────────────────────────────────────────────────────────────
  const PROFILES_DATA_DIR = path.join(__dirname, "data", "profiles");

  app.get("/api/profiles", (_req, res) => {
    try {
      if (!fs.existsSync(PROFILES_DATA_DIR)) return res.json([]);
      const profiles = fs.readdirSync(PROFILES_DATA_DIR)
        .filter(f => f.endsWith(".json"))
        .map(f => {
          const raw = JSON.parse(fs.readFileSync(path.join(PROFILES_DATA_DIR, f), "utf-8"));
          // Attach soul file content if it exists
          const soulPath = path.join(__dirname, raw.soulFile || "");
          if (fs.existsSync(soulPath)) raw.soulContent = fs.readFileSync(soulPath, "utf-8");
          else raw.soulContent = null;
          return raw;
        });
      res.json(profiles);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post("/api/profiles", express.json(), (req, res) => {
    try {
      const profile = req.body;
      if (!profile.id || !profile.name) {
        return res.status(400).json({ error: "id and name are required" });
      }
      
      const id = profile.id.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      const profilePath = path.join(PROFILES_DATA_DIR, `${id}.json`);
      
      if (fs.existsSync(profilePath)) {
        return res.status(409).json({ error: "Persona already exists" });
      }

      // Ensure data/profiles and data/souls exist
      if (!fs.existsSync(PROFILES_DATA_DIR)) {
        fs.mkdirSync(PROFILES_DATA_DIR, { recursive: true });
      }
      const SOULS_DIR = path.join(__dirname, "data", "souls");
      if (!fs.existsSync(SOULS_DIR)) {
        fs.mkdirSync(SOULS_DIR, { recursive: true });
      }

      const soulFile = `data/souls/${id}.md`;
      const soulPath = path.join(__dirname, soulFile);

      // Create a default soul content
      const soulContent = `# ${profile.name}\n\n**Role:** ${profile.role || "Specialist"}\n**Identity:** ${profile.rank} of ${profile.suit}\n\n## Core Directives\n1. Maintain maximum analytical fidelity.\n2. Standardize reporting according to Hub templates.\n`;
      fs.writeFileSync(soulPath, soulContent, "utf-8");

      const newProfile = {
        id,
        name: profile.name,
        suit: profile.suit || "spades",
        rank: profile.rank || "jack",
        role: profile.role || "Specialist",
        tagline: profile.tagline || "Ready to execute swarm operations.",
        model: profile.model || "huggingface/Qwen/Qwen3.6:novita",
        modelLabel: profile.modelLabel || "QWEN-3.6",
        modelColor: profile.modelColor || "#3b82f6",
        badge: "LOCAL",
        synced: true,
        accentColor: profile.accentColor || "#3b82f6",
        soulFile,
        skills: profile.skills || [],
        tools: profile.tools || [],
        mcps: [],
        connectors: [],
        integrations: [],
        crons: [],
        memory: "shared",
        stats: {
          sessionsTotal: 0,
          messagesTotal: 0,
          lastActive: "Just now"
        },
        imageUrl: profile.imageUrl || `/assets/agents/${id}.png`
      };

      atomicWriteFileSync(profilePath, JSON.stringify(newProfile, null, 2));
      res.status(201).json({ ...newProfile, soulContent });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/profiles/:id/soul", express.text({ type: "*/*" }), (req, res) => {
    try {
      const id = req.params.id;
      const profilePath = path.join(PROFILES_DATA_DIR, `${id}.json`);
      if (!fs.existsSync(profilePath)) return res.status(404).json({ error: "not found" });
      const profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
      const soulPath = path.join(__dirname, profile.soulFile);
      fs.writeFileSync(soulPath, req.body as string, "utf-8");
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.patch("/api/profiles/:id/model", express.json(), (req, res) => {
    try {
      const id = req.params.id;
      const profilePath = path.join(PROFILES_DATA_DIR, `${id}.json`);
      if (!fs.existsSync(profilePath)) return res.status(404).json({ error: "not found" });
      const profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
      const BLOCKED = new Set(["id", "suit", "rank", "role"]);
      const updates = req.body as Record<string, unknown>;
      for (const key of Object.keys(updates)) {
        if (BLOCKED.has(key)) return res.status(400).json({ error: `cannot update identity field: ${key}` });
      }
      const updated = { ...profile, ...updates };
      atomicWriteFileSync(profilePath, JSON.stringify(updated, null, 2));
      res.json({ ok: true, profile: updated });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── FLUX Image Generation ───────────────────────────────────────────────
  app.post("/api/flux/generate", express.json(), async (req, res) => {
    try {
      const { prompt, width = 1024, height = 1024, clientId = "default" } = req.body as {
        prompt?: string; width?: number; height?: number; clientId?: string;
      };
      if (!prompt?.trim()) return res.status(400).json({ error: "prompt required" });

      const hfToken = process.env.HF_API_TOKEN;
      if (!hfToken) return res.status(500).json({ error: "HF_API_TOKEN not configured" });

      const response = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
        method: "POST",
        headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: prompt, parameters: { width, height } }),
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(502).json({ error: `FLUX API error: ${err.slice(0, 200)}` });
      }

      const imgDir = path.join(__dirname, "public", "flux", clientId);
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

      const timestamp = Date.now();
      const imgPath = path.join(imgDir, `${timestamp}.png`);
      const buf = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(imgPath, buf);

      const url = `/flux/${clientId}/${timestamp}.png`;
      res.json({ ok: true, imagePath: imgPath, url });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Skills (Claude Code) ─────────────────────────────────────────────────
  app.get("/api/skills", (_req, res) => {
    try {
      const skillsDir = "C:/Users/profs/.claude/skills";
      if (!fs.existsSync(skillsDir)) return res.json([]);
      const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => {
          const mdPath = path.join(skillsDir, d.name, "README.md");
          const desc = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf-8").split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() || "" : "";
          return { id: d.name, name: d.name, description: desc };
        });
      res.json(skills);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Supertonic TTS ───────────────────────────────────────────────────────
  const TTS_VENV_PYTHON = "C:/Users/profs/Documents/Hermes/supertonic/.venv/Scripts/python.exe";
  const TTS_SCRIPT = path.join(__dirname, "scripts", "tts_synthesize.py");
  const TTS_OUT_DIR = path.join(__dirname, "public", "tts");

  app.post("/api/tts/synthesize", express.json(), (req, res) => {
    const { text, voice = "F1", lang = "en", speed = 1.05, steps = 8 } = req.body as {
      text?: string; voice?: string; lang?: string; speed?: number; steps?: number;
    };
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    const slug = `${Date.now()}_${voice}_${lang}`;
    const outFile = path.join(TTS_OUT_DIR, `${slug}.wav`);

    fs.mkdirSync(TTS_OUT_DIR, { recursive: true });

    const proc = spawn(TTS_VENV_PYTHON, [
      TTS_SCRIPT,
      "--text", text.trim(),
      "--voice", voice,
      "--lang", lang,
      "--speed", String(speed),
      "--steps", String(steps),
      "--out", outFile,
    ]);

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      try {
        const result = JSON.parse(stdout.trim());
        if (result.ok) {
          res.json({ ok: true, url: `/tts/${slug}.wav`, duration_s: result.duration_s, voice, lang });
        } else {
          res.status(500).json({ ok: false, error: result.error });
        }
      } catch {
        res.status(500).json({ ok: false, error: stderr || stdout || `exit ${code}` });
      }
    });
  });

  app.get("/api/tts/voices", (_req, res) => {
    res.json([
      { id: "M1", label: "Male 1",   gender: "M" },
      { id: "M2", label: "Male 2",   gender: "M" },
      { id: "M3", label: "Male 3",   gender: "M" },
      { id: "M4", label: "Male 4",   gender: "M" },
      { id: "M5", label: "Male 5",   gender: "M" },
      { id: "F1", label: "Female 1", gender: "F" },
      { id: "F2", label: "Female 2", gender: "F" },
      { id: "F3", label: "Female 3", gender: "F" },
      { id: "F4", label: "Female 4", gender: "F" },
      { id: "F5", label: "Female 5", gender: "F" },
    ]);
  });

  app.get("/api/tts/history", (_req, res) => {
    try {
      if (!fs.existsSync(TTS_OUT_DIR)) return res.json([]);
      const files = fs.readdirSync(TTS_OUT_DIR)
        .filter(f => f.endsWith(".wav"))
        .map(f => {
          const [ts, voice, lang] = f.replace(".wav", "").split("_");
          const stat = fs.statSync(path.join(TTS_OUT_DIR, f));
          return { file: f, url: `/tts/${f}`, voice, lang, ts: Number(ts), size: stat.size, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 50);
      res.json(files);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // Serve TTS audio files
  app.use("/tts", express.static(TTS_OUT_DIR));

  // ─── OpenClaw ─────────────────────────────────────────────────────────────
  app.post("/api/openclaw/run", (req, res) => {
    const { task, cwd } = req.body as { task?: string; cwd?: string };
    if (!task) return res.status(400).json({ error: "task required" });
    if (openclawProcess) return res.status(409).json({ error: "already running" });
    openclawProcess = spawn("openclaw", [task], { shell: true, cwd: cwd || __dirname });
    openclawProcess.stdout?.on("data", (d: Buffer) => appendOpenclawLog(d.toString()));
    openclawProcess.stderr?.on("data", (d: Buffer) => appendOpenclawLog(d.toString()));
    openclawProcess.on("close", (code) => { appendOpenclawLog(`[exited: ${code}]`); openclawProcess = null; });
    res.json({ ok: true });
  });

  app.get("/api/openclaw/status", (_req, res) => res.json({ running: openclawProcess !== null }));
  app.get("/api/openclaw/logs", (_req, res) => res.json({ lines: openclawLogBuffer }));

  app.post("/api/openclaw/stop", (_req, res) => {
    openclawProcess?.kill(); openclawProcess = null;
    res.json({ ok: true });
  });

  // ─── Hermes proxy → port 8642 ─────────────────────────────────────────────
  app.all("/hermes-proxy/*", async (req, res) => {
    const suffix = req.path.replace("/hermes-proxy", "");
    const url = `http://127.0.0.1:${HERMES_PORT}${suffix}`;
    try {
      const body = ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body);
      const upstream = await fetch(url, {
        method: req.method,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(
          Object.entries(req.headers).filter(([k]) => !["host", "connection"].includes(k)) as [string, string][]
        )},
        body,
      });
      res.status(upstream.status);
      upstream.headers.forEach((v, k) => { if (!["transfer-encoding"].includes(k)) res.setHeader(k, v); });
      const buf = await upstream.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch {
      res.status(503).json({ error: "hermes offline", code: "HERMES_OFFLINE" });
    }
  });

  // ─── Instagram Pipeline ───────────────────────────────────────────────────
  const IG_DB_PATH = "C:/Users/profs/Documents/Hermes/severus-social/store/posts.sqlite";
  const IG_MIGRATION = "C:/Users/profs/Documents/Hermes/severus-social/store/migrations/001_init.sql";

  function getIgDb(): InstanceType<typeof Database> {
    const db = new Database(IG_DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    if (fs.existsSync(IG_MIGRATION)) db.exec(fs.readFileSync(IG_MIGRATION, "utf-8"));
    return db;
  }

  app.get("/api/ig/queue", (_req, res) => {
    try {
      const db = getIgDb();
      const slots = db.prepare(`
        SELECT s.*, GROUP_CONCAT(v.id || '||' || v.hook_style || '||' || v.hook_text || '||' || v.caption || '||' || COALESCE(v.thumbnail_path,'') || '||' || COALESCE(v.render_path,''), ';;') as variants_raw
        FROM slots s
        LEFT JOIN variants v ON v.slot_id = s.id
        WHERE s.approval_state = 'queued'
        GROUP BY s.id
        ORDER BY s.post_at ASC
      `).all() as Record<string, unknown>[];
      db.close();
      const parsed = slots.map(s => ({
        ...s,
        variants: s.variants_raw ? String(s.variants_raw).split(";;").map((r: string) => {
          const [id, hook_style, hook_text, caption, thumbnail_path, render_path] = r.split("||");
          return { id, hook_style, hook_text, caption, thumbnail_path, render_path };
        }) : [],
      }));
      res.json({ success: true, data: parsed });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.get("/api/ig/calendar", (req, res) => {
    try {
      const db = getIgDb();
      const { account } = req.query as { account?: string };
      const slots = account
        ? db.prepare(`SELECT * FROM slots WHERE account = ? ORDER BY post_at ASC LIMIT 100`).all(account)
        : db.prepare(`SELECT * FROM slots ORDER BY post_at ASC LIMIT 100`).all();
      db.close();
      res.json({ success: true, data: slots });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.get("/api/ig/metrics", (req, res) => {
    try {
      const db = getIgDb();
      const { account, range = "30" } = req.query as { account?: string; range?: string };
      const days = parseInt(String(range).replace("d", ""), 10) || 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const rows = db.prepare(`
        SELECT s.id, s.account, s.pillar, s.post_at, s.permalink,
               v.hook_style, v.hook_text,
               m.reach, m.saves, m.sends, m.watch_time_s, m.score
        FROM slots s
        LEFT JOIN variants v ON v.id = s.selected_variant_id
        LEFT JOIN metrics m ON m.slot_id = s.id
        WHERE s.approval_state = 'published'
          AND s.post_at >= ?
          ${account ? "AND s.account = ?" : ""}
        ORDER BY s.post_at DESC
        LIMIT 60
      `).all(...(account ? [since, account] : [since]));
      db.close();
      res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.post("/api/ig/approve", (req, res) => {
    try {
      const { slot_id, variant_id } = req.body as { slot_id: string; variant_id: string };
      if (!slot_id || !variant_id) return res.status(400).json({ success: false, error: "slot_id and variant_id required" });
      const db = getIgDb();
      const slot = db.prepare("SELECT * FROM slots WHERE id = ?").get(slot_id) as Record<string, unknown> | undefined;
      if (!slot) { db.close(); return res.status(404).json({ success: false, error: "slot not found" }); }
      if (slot.approval_state !== "queued") { db.close(); return res.status(409).json({ success: false, error: `slot is ${slot.approval_state}` }); }
      db.prepare("UPDATE slots SET approval_state = 'approved', selected_variant_id = ?, updated_at = datetime('now') WHERE id = ?")
        .run(variant_id, slot_id);
      db.close();
      res.json({ success: true, slot_id, variant_id });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.post("/api/ig/reject", (req, res) => {
    try {
      const { slot_id, reason } = req.body as { slot_id: string; reason?: string };
      if (!slot_id) return res.status(400).json({ success: false, error: "slot_id required" });
      const db = getIgDb();
      db.prepare("UPDATE slots SET approval_state = 'rejected', updated_at = datetime('now') WHERE id = ?").run(slot_id);
      db.close();
      res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.patch("/api/ig/slot/:id", (req, res) => {
    try {
      const { caption, hashtags, post_at, variant_id } = req.body as { caption?: string; hashtags?: string; post_at?: string; variant_id?: string };
      const db = getIgDb();
      const slot = db.prepare("SELECT selected_variant_id FROM slots WHERE id = ?").get(req.params.id) as { selected_variant_id: string } | undefined;
      if (!slot) { db.close(); return res.status(404).json({ success: false, error: "not found" }); }
      const targetVariant = variant_id || slot.selected_variant_id;
      if ((caption || hashtags) && targetVariant) {
        db.prepare("UPDATE variants SET caption = COALESCE(?, caption), hashtags = COALESCE(?, hashtags) WHERE id = ?")
          .run(caption ?? null, hashtags ?? null, targetVariant);
      }
      if (post_at) {
        db.prepare("UPDATE slots SET post_at = ?, updated_at = datetime('now') WHERE id = ?").run(post_at, req.params.id);
      }
      db.close();
      res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  // HMAC one-tap approve/reject via email links
  app.get("/api/ig/approve", (req, res) => {
    try {
      const { token, slot, variant } = req.query as { token?: string; slot?: string; variant?: string };
      if (!token || !slot || !variant) return res.status(400).send("Missing parameters");
      const secret = process.env.APPROVAL_HMAC_SECRET || "dev-secret";
      const [sig, expStr] = token.split(".");
      if (!sig || !expStr || Date.now() > parseInt(expStr, 10)) return res.status(401).send("Token expired or invalid");
      const expected = require("crypto").createHmac("sha256", secret).update(`${slot}:${variant}:${expStr}`).digest("hex");
      if (!require("crypto").timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(401).send("Invalid token");
      const db = getIgDb();
      db.prepare("UPDATE slots SET approval_state = 'approved', selected_variant_id = ?, updated_at = datetime('now') WHERE id = ? AND approval_state = 'queued'")
        .run(variant, slot);
      db.close();
      res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#10b981"><h2>✓ Approved</h2><p>Post scheduled. Close this tab.</p></body></html>`);
    } catch (e) { res.status(500).send("Error: " + String(e)); }
  });

  app.get("/api/ig/reject", (req, res) => {
    try {
      const { token, slot } = req.query as { token?: string; slot?: string };
      if (!token || !slot) return res.status(400).send("Missing parameters");
      const secret = process.env.APPROVAL_HMAC_SECRET || "dev-secret";
      const [sig, expStr] = token.split(".");
      if (!sig || !expStr || Date.now() > parseInt(expStr, 10)) return res.status(401).send("Token expired or invalid");
      const expected = require("crypto").createHmac("sha256", secret).update(`${slot}:reject:${expStr}`).digest("hex");
      if (!require("crypto").timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(401).send("Invalid token");
      const db = getIgDb();
      db.prepare("UPDATE slots SET approval_state = 'rejected', updated_at = datetime('now') WHERE id = ?").run(slot);
      db.close();
      res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#ef4444"><h2>✗ Rejected</h2><p>Post rejected. Close this tab.</p></body></html>`);
    } catch (e) { res.status(500).send("Error: " + String(e)); }
  });

  // Feedback brief (Insights panel Save Brief)
  const IG_FEEDBACK_PATH = "C:/Users/profs/Documents/Hermes/severus-social/store/feedback-brief.txt";
  app.post("/api/ig/feedback", express.text({ type: "*/*" }), (req, res) => {
    try {
      fs.writeFileSync(IG_FEEDBACK_PATH, req.body as string, "utf-8");
      res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.get("/api/ig/feedback", (_req, res) => {
    try {
      const content = fs.existsSync(IG_FEEDBACK_PATH) ? fs.readFileSync(IG_FEEDBACK_PATH, "utf-8") : "";
      res.json({ success: true, data: content });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  // Seed a test slot for UI development (only if DB is empty)
  app.post("/api/ig/seed-test", (_req, res) => {
    try {
      const db = getIgDb();
      const existing = db.prepare("SELECT COUNT(*) as n FROM slots").get() as { n: number };
      if (existing.n > 0) { db.close(); return res.json({ success: true, seeded: false, message: "already has data" }); }
      const slotId = "mikeb-2026-05-21";
      db.prepare(`INSERT OR IGNORE INTO slots (id, account, post_at, pillar, approval_state)
        VALUES (?, 'mikeb', '2026-05-21T17:00:00.000Z', 'ai-tool-demo', 'queued')`).run(slotId);
      const hookStyles = ["transformation", "contrarian", "curiosity-gap"];
      const hooks = [
        { text: "30 mins → 30 secs", caption: "Legal teams are drowning in boilerplate. I built a triple-agent pipeline to kill the grind." },
        { text: "Most AI tools are overrated", caption: "Everyone is obsessed with AI wrappers. Here's the only stack that actually shipped for me." },
        { text: "I gave Claude my calendar for a week", caption: "What happened when I let an AI agent manage my entire week as a founder." },
      ];
      hookStyles.forEach((style, i) => {
        const id = `${slotId}-v${i + 1}`;
        db.prepare(`INSERT OR IGNORE INTO variants (id, slot_id, hook_style, hook_text, caption, hashtags)
          VALUES (?, ?, ?, ?, ?, ?)`).run(id, slotId, style, hooks[i].text, hooks[i].caption, "#AITools #BuildInPublic #TechnicalFounder #AIEngineering #ClaudeAI");
      });
      db.close();
      res.json({ success: true, seeded: true });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  // ─── Knowledge Base — cloned repos + vault sections ──────────────────────
  const HERMES_ROOT = "C:/Users/profs/Documents/Hermes";
  const CLONED_REPOS = ["jcodemunch-mcp", "mattpocock-skills", "andrej-karpathy-skills", "clean-code-skills", "rtk"];
  const REPO_META: Record<string, { description: string; purpose: string; relevance: string; color: string; icon: string }> = {
    "jcodemunch-mcp":         { description: "Tree-sitter AST codebase indexer MCP server", purpose: "95% token reduction via symbol-level code lookup", relevance: "Core infrastructure — all code navigation uses this", color: "#22c55e", icon: "🧩" },
    "mattpocock-skills":      { description: "Composable real-engineering agent skills by Matt Pocock", purpose: "Small, hackable, model-agnostic skills for actual dev work", relevance: "Reference for building /sc skill commands", color: "#60a5fa", icon: "⚡" },
    "andrej-karpathy-skills": { description: "4-principle CLAUDE.md from Karpathy's LLM pitfall observations", purpose: "Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven", relevance: "Source of Hermes Architectural Laws #1–3", color: "#f472b6", icon: "🧠" },
    "clean-code-skills":      { description: "66 Robert C. Martin Clean Code rules as agent skills", purpose: "Python + TypeScript tracks — boy-scout orchestrator", relevance: "Applies directly to severus-social, hermes-hub TypeScript code", color: "#f59e0b", icon: "✨" },
    "rtk":                    { description: "Rust Token Killer — CLI proxy compressing output 60–90%", purpose: "Filters shell stdout before it hits LLM context", relevance: "Mandatory — all shell calls prefixed with `rtk`", color: "#ef4444", icon: "🦀" },
  };

  app.get("/api/vault/repos", (_req, res) => {
    try {
      const repos = CLONED_REPOS.map(name => {
        const repoPath = path.join(HERMES_ROOT, name);
        const meta = REPO_META[name] ?? { description: "", purpose: "", relevance: "", color: "#9ca3af", icon: "📦" };
        return { name, path: repoPath, ...meta };
      });

      const VAULT_HERMES = path.join(OBSIDIAN_VAULT, "Hermes OS");
      const vault: { section: string; path: string; files: { name: string; path: string; mtime: number }[] }[] = [];
      if (fs.existsSync(VAULT_HERMES)) {
        for (const entry of fs.readdirSync(VAULT_HERMES, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
          const sectionPath = path.join(VAULT_HERMES, entry.name);
          const files = walkDir(sectionPath, ".md").map(fp => ({
            name: path.basename(fp, ".md"),
            path: fp,
            mtime: fs.statSync(fp).mtimeMs,
          }));
          vault.push({ section: entry.name, path: sectionPath, files });
        }
      }
      res.json({ repos, vault });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Studio Exports (NotebookLM → Hyperframes feed) ─────────────────────
  const STUDIO_DIR = path.join(__dirname, "../studio-exports");

  app.get("/api/studio/exports", (_req, res) => {
    try {
      const csvPath = path.join(STUDIO_DIR, "hermes-agency-matrix.csv");
      const mapPath = path.join(STUDIO_DIR, "hermes-mindmap.json");
      const mfPath  = path.join(STUDIO_DIR, "renders", "manifest.json");
      res.json({
        csv_ready:      fs.existsSync(csvPath),
        mindmap_ready:  fs.existsSync(mapPath),
        manifest_ready: fs.existsSync(mfPath),
        csv_path:       csvPath,
        mindmap_path:   mapPath,
        manifest:       fs.existsSync(mfPath) ? JSON.parse(fs.readFileSync(mfPath, "utf-8")) : null,
      });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post("/api/studio/render", (req, res) => {
    try {
      const script = path.join(STUDIO_DIR, "generate-slides.mjs");
      if (!fs.existsSync(script)) return res.status(404).json({ error: "generate-slides.mjs not found" });
      const brief = String((req.body ?? {}).brief ?? "").slice(0, 4000);
      const env = { ...process.env, STUDIO_BRIEF: brief };
      const child = spawn("node", [script], { cwd: STUDIO_DIR, shell: true, env });
      child.stdout?.on("data", (d: Buffer) => console.log("[studio]", d.toString().trim()));
      child.stderr?.on("data", (d: Buffer) => console.error("[studio]", d.toString().trim()));
      child.on("close", code => console.log(`[studio] exited: ${code}`));
      res.json({ ok: true, message: "Render started — check studio-exports/ for output", brief_received: brief.length > 0 });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Discovery / Vault routes ─────────────────────────────────────────────
  const VAULT_ROOT = process.env.OBSIDIAN_VAULT || "C:/Users/profs/Desktop/Sandbox";
  const RESEARCH_DIR = `${VAULT_ROOT}/Research`;

  app.get("/api/discovery/vault", (req, res) => {
    try {
      const rel = String(req.query.path || "").replace(/\.\./g, "");
      const abs = rel ? path.join(VAULT_ROOT, rel) : VAULT_ROOT;
      if (!fs.existsSync(abs)) return res.json({ success: false, error: "Not found" });
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(abs)
          .filter((n) => !n.startsWith("."))
          .map((name) => {
            const full = path.join(abs, name);
            const isDir = fs.statSync(full).isDirectory();
            return { name, path: rel ? `${rel}/${name}` : name, type: isDir ? "dir" : "file" };
          })
          .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
        res.json({ success: true, data: { type: "dir", entries } });
      } else {
        const content = fs.readFileSync(abs, "utf8");
        res.json({ success: true, data: { type: "file", content } });
      }
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.get("/api/discovery/vault/search", (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) return res.json({ success: true, data: [] });
      // Tokenise: each whitespace-separated word is an AND term. File must contain ALL terms.
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (terms.length === 0) return res.json({ success: true, data: [] });
      const results: Array<{ file: string; line: number; content: string; matched_term: string }> = [];
      const vaultLower = VAULT_ROOT.toLowerCase();

      const walk = (dir: string): void => {
        if (results.length >= 60) return;
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          if (results.length >= 60) return;
          if (e.isDirectory()) {
            if (e.name.startsWith(".") || e.name === "node_modules") continue;
            walk(path.join(dir, e.name));
            continue;
          }
          if (!e.isFile() || !e.name.toLowerCase().endsWith(".md")) continue;
          const full = path.join(dir, e.name);
          let text: string;
          try { text = fs.readFileSync(full, "utf8"); } catch { continue; }
          const textLower = text.toLowerCase();
          // AND: file must contain every term
          if (!terms.every((t) => textLower.includes(t))) continue;
          const lines = text.split("\n");
          // Normalize both sides to forward-slash + lowercase for comparison, but emit the original case
          const fullFwd = full.replace(/\\/g, "/");
          const rel = fullFwd.toLowerCase().startsWith(vaultLower.replace(/\\/g, "/"))
            ? fullFwd.slice(VAULT_ROOT.length).replace(/^[\\/]+/, "")
            : fullFwd;
          // Show lines that match ANY term, capped at 6 per file
          let perFile = 0;
          for (let i = 0; i < lines.length && results.length < 60 && perFile < 6; i++) {
            const lower = lines[i].toLowerCase();
            const hit = terms.find((t) => lower.includes(t));
            if (hit) {
              results.push({ file: rel, line: i + 1, content: lines[i].trim().slice(0, 240), matched_term: hit });
              perFile++;
            }
          }
        }
      };

      walk(VAULT_ROOT);
      res.json({ success: true, data: results, terms });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.post("/api/discovery/save", (req, res) => {
    try {
      if (!fs.existsSync(RESEARCH_DIR)) fs.mkdirSync(RESEARCH_DIR, { recursive: true });
      const date = new Date().toISOString().slice(0, 10);
      const filename = path.join(RESEARCH_DIR, `${date}-scratchpad.md`);
      const existing = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
      const separator = existing ? "\n\n---\n\n" : "";
      fs.writeFileSync(filename, existing + separator + (req.body.content || ""), "utf8");
      res.json({ success: true, file: filename });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.post("/api/discovery/analyse", async (req, res) => {
    try {
      const content = String(req.body.content || "").slice(0, 8000);
      if (!content.trim()) return res.json({ success: false, error: "No content" });
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic();
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: `Summarise the following content in 3-5 bullet points. Extract the most actionable or surprising insights for a marketing/ads agency founder. Be direct, no fluff.\n\n${content}`,
        }],
      });
      const text = (msg.content[0] as { text: string }).text;
      res.json({ success: true, data: text });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.get("/api/services/agents", (_req, res) => {
    const AGENTS_DIR = "C:/Users/profs/Desktop/Sandbox/Agents";
    try {
      const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith(".md") && f !== "TEMPLATE.md" && f !== "README.md");
      const agents = files.map(filename => {
        const content = fs.readFileSync(path.join(AGENTS_DIR, filename), "utf8");
        const nameMatch = content.match(/^#\s+(.+?)\s+Agent Profile/m);
        const serviceMatch = content.match(/\*\*Service:\*\*\s*(.+)/);
        const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
        const permMatch = content.match(/\*\*Permission Level:\*\*\s*(.+)/);
        const pricingMatch = content.match(/\*\*Pricing[^:]*:\*\*\s*(.+)/);
        const slug = filename.replace(".md", "");
        const track = slug.startsWith("Severus-Bundle") ? "bundle"
          : slug.startsWith("Severus-Design") ? "design"
          : slug.startsWith("Severus-Social") ? "social"
          : slug.startsWith("Severus-Connects") ? "ads"
          : slug.startsWith("Severus-") ? "ops"
          : "other";
        return {
          slug,
          filename,
          name: nameMatch ? nameMatch[1].trim() : slug,
          service: serviceMatch ? serviceMatch[1].trim() : "",
          status: statusMatch ? statusMatch[1].trim() : "Active",
          permission: permMatch ? permMatch[1].trim() : "WHITELIST",
          pricing: pricingMatch ? pricingMatch[1].trim() : null,
          track,
        };
      });
      res.json({ success: true, agents });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
  });

  app.get("/api/discovery/notebooks", (_req, res) => {
    const { execFile } = require("child_process");
    execFile("notebooklm", ["list", "--json"], { timeout: 15000, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }, (err: Error | null, stdout: string) => {
      if (err) return res.json({ success: false, notebooks: [], error: String(err) });
      try {
        const parsed = JSON.parse(stdout);
        res.json({ success: true, notebooks: Array.isArray(parsed) ? parsed : parsed.notebooks || [] });
      } catch {
        res.json({ success: false, notebooks: [], error: "Parse error" });
      }
    });
  });

  // ─── OpenShorts proxy → port 8000 ─────────────────────────────────────────
  const OPENSHORTS_API = "http://127.0.0.1:8000";

  app.get("/api/openshorts/status", async (_req, res) => {
    try {
      const r = await fetch(`${OPENSHORTS_API}/health`);
      res.json({ online: r.ok });
    } catch { res.json({ online: false }); }
  });

  app.post("/api/openshorts/clip", async (req, res) => {
    try {
      const r = await fetch(`${OPENSHORTS_API}/clip`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(3000),
      });
      res.json(await r.json());
    } catch {
      res.status(503).json({
        error: "OpenShorts service offline",
        hint: `Start the OpenShorts container, then retry. Expected at ${OPENSHORTS_API}.`,
      });
    }
  });

  app.get("/api/openshorts/jobs", async (_req, res) => {
    try {
      const r = await fetch(`${OPENSHORTS_API}/jobs`);
      res.json(await r.json());
    } catch { res.json([]); }
  });

  // ─── Voicebox proxy → port 17493 ───────────────────────────────────────────
  const VOICEBOX_API = "http://127.0.0.1:17493";

  app.get("/api/voicebox/status", async (_req, res) => {
    try {
      const r = await fetch(`${VOICEBOX_API}/health`);
      res.json({ online: r.ok });
    } catch { res.json({ online: false }); }
  });

  app.get("/api/voicebox/voices", async (_req, res) => {
    try {
      const r = await fetch(`${VOICEBOX_API}/voices`);
      res.json(await r.json());
    } catch { res.json([]); }
  });

  app.post("/api/voicebox/synthesize", async (req, res) => {
    try {
      const r = await fetch(`${VOICEBOX_API}/synthesize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      res.json(await r.json());
    } catch (e) { res.status(502).json({ error: String(e) }); }
  });

  // ─── Hermes Command Chat (orchestrator with tool-use) ─────────────────────
  app.post("/api/chat", async (req, res) => {
    const { message, chat_id, model } = req.body ?? {};
    if (!message) { res.status(400).json({ error: "message required" }); return; }
    try {
      const result = await orchestrate(String(chat_id ?? "default"), String(message), model ? String(model) : undefined);
      
      // Determine intent based on executed tool calls or prompt keyword analysis
      let intent = "CHAT";
      const toolsExecuted = (result.toolCalls || []).map(tc => tc.tool);
      if (toolsExecuted.some(t => ["ig_render", "generate_image", "clip_video"].includes(t))) {
        intent = "RENDER";
      } else if (toolsExecuted.some(t => ["analyze_creative"].includes(t))) {
        intent = "VISION_ANALYZE";
      } else if (toolsExecuted.some(t => ["audit", "ig_metrics", "audit_upwork", "upwork_feed_refresh", "upwork_feed_add"].includes(t))) {
        intent = "ANALYTICS";
      } else if (toolsExecuted.some(t => ["synthesize_voice"].includes(t))) {
        intent = "COPYWRITE";
      } else if (toolsExecuted.some(t => ["whats_pending", "list_tasks", "kanban_view", "kanban_move", "schedule", "list_scheduled", "cancel_scheduled"].includes(t))) {
        intent = "STATUS";
      } else if (toolsExecuted.some(t => ["read_file", "write_file", "list_dir", "vault_search", "vault_read", "vault_write", "notebooklm_add", "kb_repos", "kb_notebooks", "kb_graph"].includes(t))) {
        intent = "VAULT";
      } else {
        // Fallback to text keyword analysis
        const msgUpper = String(message).toUpperCase();
        if (msgUpper.includes("RENDER") || msgUpper.includes("IMAGE") || msgUpper.includes("REEL") || msgUpper.includes("VIDEO") || msgUpper.includes("PICTURE") || msgUpper.includes("FLUX")) {
          intent = "RENDER";
        } else if (msgUpper.includes("VISION") || msgUpper.includes("ANALYZE") || msgUpper.includes("LOOK") || msgUpper.includes("SEE") || msgUpper.includes("CLIP")) {
          intent = "VISION_ANALYZE";
        } else if (msgUpper.includes("ANALYTICS") || msgUpper.includes("UPWORK") || msgUpper.includes("LINKEDIN") || msgUpper.includes("METRICS") || msgUpper.includes("AUDIT")) {
          intent = "ANALYTICS";
        } else if (msgUpper.includes("WRITE") || msgUpper.includes("COPY") || msgUpper.includes("HOOK") || msgUpper.includes("HEADLINE") || msgUpper.includes("VOICE") || msgUpper.includes("TTS") || msgUpper.includes("SPEAK")) {
          intent = "COPYWRITE";
        } else if (msgUpper.includes("STATUS") || msgUpper.includes("PENDING") || msgUpper.includes("QUEUE") || msgUpper.includes("KANBAN") || msgUpper.includes("SCHEDULE")) {
          intent = "STATUS";
        } else if (msgUpper.includes("VAULT") || msgUpper.includes("SEARCH") || msgUpper.includes("FILE") || msgUpper.includes("NOTE") || msgUpper.includes("NOTEBOOKLM")) {
          intent = "VAULT";
        }
      }

      let delegatedCard: DelegatedCard | undefined;
      const mapping = INTENT_TO_DELEGATION[intent];
      if (mapping) {
        try {
          delegatedCard = delegateCard({
            title: String(message),
            assignee: mapping.assignee,
            priority: mapping.priority,
            column: mapping.column,
            chatId: String(chat_id ?? "default"),
            intent,
          });
        } catch (e) {
          console.warn("[delegate] kanban write failed:", e);
        }
      }

      res.json({ reply: result.reply, tool_calls: result.toolCalls, intent, delegated_card: delegatedCard });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/chat/clear", (req, res) => {
    const { chat_id } = req.body ?? {};
    clearHistory(String(chat_id ?? "default"));
    res.json({ cleared: true });
  });

  app.get("/api/chat/conversations", (_req, res) => {
    try {
      res.json(listConversations());
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.get("/api/chat/history/:chat_id", (req, res) => {
    try {
      res.json({ chat_id: req.params.chat_id, messages: loadFullHistory(req.params.chat_id) });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post("/api/chat/new", (_req, res) => {
    const chat_id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    res.json({ chat_id });
  });

  app.get("/api/chat/tools", (_req, res) => {
    res.json(listTools());
  });

  // Legacy single-shot stub (kept for backward compat — orchestrator above handles real traffic)
  app.post("/api/chat-legacy", async (req, res) => {
    const { message } = req.body ?? {};
    if (!message) { res.status(400).json({ error: "message required" }); return; }

    const hfToken = process.env.HF_API_TOKEN;
    if (!hfToken) { res.status(500).json({ error: "HF_API_TOKEN not configured" }); return; }

    const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct:cerebras";
    const HF_URL = "https://router.huggingface.co/v1/chat/completions";
    const hfHeaders = { "Authorization": `Bearer ${hfToken}`, "content-type": "application/json" };

    const hfChat = async (system: string, userMsg: string, maxTokens = 400): Promise<string> => {
      const r = await fetch(HF_URL, {
        method: "POST",
        headers: hfHeaders,
        body: JSON.stringify({
          model: HF_MODEL,
          temperature: 0.3,
          max_tokens: maxTokens,
          messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
        }),
      });
      const d = await r.json() as { choices?: Array<{ message: { content: string } }>; error?: string };
      if (d.error) console.error("[hfChat]", d.error);
      return d.choices?.[0]?.message?.content?.trim() ?? "";
    };

    const msg = String(message);
    const lower = msg.toLowerCase();
    let intent = "";
    let pillar: string | null = null;
    let query = msg;

    // Step 1a: regex fast-path — catches ~80% of intents in zero ms
    const PILLAR_RX = /(case[-\s]?study|ga4[-\s]?tip|ads?[-\s]?tip|process[-\s]?breakdown|client[-\s]?result)/i;
    const pillarMatch = lower.match(PILLAR_RX);
    if (pillarMatch) pillar = pillarMatch[1].replace(/\s+/g, "-").toLowerCase().replace("ads-tip", "ads-tip");

    if (/\b(render|kick off|trigger|run the pipeline|make a reel|create.*reel|heartbeat)\b/i.test(lower)) {
      intent = "RENDER";
    } else if (/\b(vision|analyz[es]|analyse|analyser|critique|review).*\b(reel|video|image|creative|ad)\b/i.test(lower)
            || /\b(vision_analyze|\/analyze)\b/i.test(lower)) {
      intent = "VISION_ANALYZE";
    } else if (/\b(hook|caption|copy|script|cta|headline|write.*(ad|post|reel|reels)|3 (variants|hooks))\b/i.test(lower)) {
      intent = "COPYWRITE";
    } else if (/\b(status|last run|recent (slot|run|post)|whats? running|pipeline state|health)\b/i.test(lower)) {
      intent = "STATUS";
    } else if (/\b(analytics?|metrics?|views?|reach|impressions?|engagement|performance|ga4 data|conversions?)\b/i.test(lower)) {
      intent = "ANALYTICS";
    }

    // Step 1b: Llama fallback only when regex didn't match
    if (!intent) {
      try {
        const classifyRaw = await hfChat(
          `You classify messages for Hermes OS into one intent. Output ONLY a JSON object on a single line, no prose, no markdown.

Intents:
- RENDER: user wants to render/trigger a reel or pipeline run
- VISION_ANALYZE: user wants to analyze a video/image/creative
- ANALYTICS: questions about metrics, views, reach, performance, GA4
- COPYWRITE: user wants hooks, captions, ad copy, scripts
- STATUS: user asking about system status, recent runs, last activity
- CHAT: everything else (greetings, general questions, capability queries)

Examples:
User: "render a ga4-tip reel" -> {"intent":"RENDER","pillar":"ga4-tip"}
User: "write 3 hooks for a candle brand" -> {"intent":"COPYWRITE","pillar":null}
User: "hi" -> {"intent":"CHAT","pillar":null}
User: "how are views trending" -> {"intent":"ANALYTICS","pillar":null}

Now classify this message. Output ONLY the JSON object:`,
          msg,
          60
        );
        const jsonMatch = classifyRaw.match(/\{[^{}]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          intent = (parsed.intent ?? "CHAT").toUpperCase();
          if (!pillar) pillar = parsed.pillar ?? null;
        }
      } catch { /* fall through to CHAT */ }
      if (!intent) intent = "CHAT";
    }

    try {
      // Step 2: handle intent
      let reply = "";

      if (intent === "RENDER") {
        const targetPillar = pillar ?? "ga4-tip";
        try {
          await fetch("http://localhost:3000/api/heartbeat/on-demand", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pillar: targetPillar, account: "severus" }),
          });
        } catch { /* pipeline may not be running */ }
        reply = `Rendering **${targetPillar}** reel — approval link coming to Telegram in ~3 min.`;

      } else if (intent === "STATUS") {
        const slots = (() => {
          try {
            const db = new Database(path.join(__dirname, "..", "severus-social", "db.sqlite"));
            const rows = db.prepare("SELECT pillar, hook_style, approval_state, created_at FROM slots ORDER BY created_at DESC LIMIT 5").all() as Array<{ pillar: string; hook_style: string; approval_state: string; created_at: string }>;
            db.close();
            return rows;
          } catch { return []; }
        })();
        if (slots.length === 0) {
          reply = "No pipeline runs found yet. Use `/render <pillar>` to kick one off.";
        } else {
          reply = "**Recent pipeline slots:**\n" + slots.map(s => `• ${s.pillar} — ${s.approval_state} (${s.created_at?.slice(0,16)})`).join("\n");
        }

      } else if (intent === "COPYWRITE") {
        reply = await hfChat(
          "You are the Severus Connects CopyWriter. Write 3 hook variants (A/B/C) for Instagram Reels/TikTok. Each hook: max 12 words, pattern interrupt or curiosity gap. No banned openers (POV:, If you're a, Day N of). Return as a clean markdown list.",
          query,
          400
        );

      } else if (intent === "ANALYTICS") {
        reply = "Analytics: open the **Instagram** tab in Hermes Hub for full performance data, or check the Friday weekly review in Obsidian.";

      } else if (intent === "VISION_ANALYZE") {
        reply = "Send me the reel URL in Telegram (`⚔️ Hermes Command`) with `/vision_analyze <url>` — Gemini will analyse it and post hook JSON back.";

      } else {
        reply = await hfChat(
          `You are Hermes, the AI operating system for Severus Connects — a London agency specialising in GA4 analytics and AI-powered Google Ads for ecommerce. You help Idris run the agency.
You know about: Instagram content pipeline (heartbeat.ts), 5 storyboard templates (case-study, ga4-tip, ads-tip, process-breakdown, client-result), n8n automation workflows (01-12), Telegram approval flow, Severus brand identity (gold #D4A017 on near-black #060610).
Be concise, direct, expert. Max 3 sentences unless asked for more. No filler phrases.`,
          query,
          500
        );
      }

      res.json({ reply, intent });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ─── Vite / static ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: process.env.DISABLE_HMR === "true" ? false : { overlay: false } },
        appType: "spa",
        logLevel: "warn",
        clearScreen: false,
      });
      app.use(vite.middlewares);
      vite.httpServer?.on?.("error", (e) => console.error("[vite] httpServer error:", e));
    } catch (err) {
      console.error("[vite] failed to start — API still serving:", err);
      app.use((_req, res) => res.status(503).send("Vite dev server unavailable. Restart hermes-hub."));
    }
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  const httpServer = app.listen(3000, "0.0.0.0", () => {
    console.log("Claude Code OS → http://localhost:3000");
    try {
      startPolling().catch((e) => console.error("[startup] startPolling failed:", e));
      startUpworkCron();
      startScheduledWorker();
    } catch (err) {
      console.error("[startup] background services failed:", err);
    }
  });

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error("[FATAL] Port 3000 already in use. Exiting so watchdog can retry.");
      process.exit(1);
    }
    console.error("[FATAL] HTTP server error:", err);
    process.exit(1);
  });
}

// ── Process-level crash guards ────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err.message, err.stack);
});

startServer();
