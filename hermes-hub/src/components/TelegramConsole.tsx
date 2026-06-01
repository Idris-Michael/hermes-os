import { useEffect, useRef, useState } from "react";
import { useInterval } from "../hooks/useInterval";

const GROUPS = [
  { id: "-5034237148", label: "⚒️ Hermes Command 🃏", lane: "Strategy & Orchestration" },
  { id: "-5030845538", label: "📈 Ads & Growth Squad", lane: "Audits & Tracking" },
  { id: "-4993293739", label: "🎨 Creative & Content", lane: "Production" },
  { id: "-5175612864", label: "🔧 Build & Systems", lane: "Infra & Automations" },
  { id: "YOUR_TELEGRAM_CHAT_ID", label: "💬 Personal Chat", lane: "Direct to you" },
];

const QUICK_COMMANDS: Record<string, string[]> = {
  "Hermes Command": ["/status", "/audit_upwork", "/audit_linkedin", "/strategy ", "/biz_dev ", "/bundle "],
  "Ads & Growth": ["/audit_ga4 ", "/audit_meta ", "/audit_google ", "/shopping ", "/track "],
  "Creative & Content": ["/render_reel transformation ", "/ugc ", "/creative ", "/write_ads ", "/a11y "],
  "Build & Systems": ["/build ", "/automate "],
};

interface AgentTask {
  id: number;
  agent: string;
  instruction: string;
  status: string;
  created_at: string;
}

export default function TelegramConsole() {
  const [chatId, setChatId] = useState(GROUPS[0].id);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Array<{ t: string; who: "you" | "hub"; text: string }>>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const refreshTasks = () => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((rows) => Array.isArray(rows) && setTasks(rows))
      .catch(() => {});
  };

  useEffect(() => { refreshTasks(); }, []);
  useInterval(refreshTasks, 5000);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    const stamp = new Date().toLocaleTimeString();
    setLog((l) => [...l, { t: stamp, who: "you", text }]);
    try {
      const res = await fetch("/api/telegram/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      const data = await res.json();
      setLog((l) => [...l, { t: new Date().toLocaleTimeString(), who: "hub", text: data.ok ? "dispatched → reply in Telegram" : `error: ${data.error}` }]);
    } catch (err) {
      setLog((l) => [...l, { t: new Date().toLocaleTimeString(), who: "hub", text: `error: ${(err as Error).message}` }]);
    } finally {
      setBusy(false);
      setInput("");
    }
  }

  const queued = tasks.filter((t) => t.status === "queued").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const activeGroup = GROUPS.find((g) => g.id === chatId);
  const quickLane = activeGroup?.label.includes("Hermes") ? "Hermes Command"
    : activeGroup?.label.includes("Ads") ? "Ads & Growth"
    : activeGroup?.label.includes("Creative") ? "Creative & Content"
    : activeGroup?.label.includes("Build") ? "Build & Systems"
    : "Hermes Command";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      {/* Console */}
      <div className="rounded-lg border border-white/10 bg-black/40 flex flex-col" style={{ minHeight: 520 }}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setChatId(g.id)}
                className="text-[11px] px-2.5 py-1 rounded transition-colors"
                style={{
                  background: chatId === g.id ? "rgba(212,160,23,0.18)" : "rgba(255,255,255,0.03)",
                  color: chatId === g.id ? "#D4A017" : "#8e9bb0",
                  border: `1px solid ${chatId === g.id ? "rgba(212,160,23,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-gray-500 flex gap-3">
            <span>queued: <span className="text-amber-400">{queued}</span></span>
            <span>running: <span className="text-emerald-400">{inProgress}</span></span>
          </div>
        </div>

        {/* Lane subtitle */}
        <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-gray-500">
          {activeGroup?.lane} · chat_id {chatId}
        </div>

        {/* Quick commands */}
        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-white/5">
          {QUICK_COMMANDS[quickLane].map((c) => (
            <button
              key={c}
              onClick={() => setInput(c)}
              className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5"
            >
              {c.trim()}
            </button>
          ))}
        </div>

        {/* Log */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 font-mono text-[12px]">
          {log.length === 0 && (
            <div className="text-gray-600 italic">No messages yet. Send a command below — it routes through the same dispatcher as Telegram, and the reply lands in your Telegram chat.</div>
          )}
          {log.map((entry, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-gray-600 shrink-0">{entry.t}</span>
              <span className={entry.who === "you" ? "text-amber-300" : "text-emerald-300"}>{entry.who === "you" ? "›" : "‹"}</span>
              <span className="text-gray-200 whitespace-pre-wrap break-all">{entry.text}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/5 p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="/help · /status · /audit_upwork · /task <agent> <brief>"
            className="flex-1 bg-black/60 border border-white/10 rounded px-3 py-2 text-[12px] text-gray-200 outline-none focus:border-amber-400/40"
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="px-4 py-2 rounded text-[12px] font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* Task feed / kanban shortcut */}
      <div className="rounded-lg border border-white/10 bg-black/40 flex flex-col">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-gray-400">Live Task Queue</span>
          <a href="/overwatch#kanban" className="text-[10px] text-amber-300 hover:underline">Open Kanban →</a>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-[11px]">
          {tasks.length === 0 && <div className="text-gray-600 italic">queue empty</div>}
          {tasks.slice(0, 30).map((t) => (
            <div key={t.id} className="rounded border border-white/5 bg-black/40 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-gray-500">#{t.id}</span>
                <StatusPill status={t.status} />
              </div>
              <div className="text-amber-300 text-[10px] uppercase tracking-wider">{t.agent}</div>
              <div className="text-gray-300 mt-0.5 line-clamp-2">{t.instruction}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    queued: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    error: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  const cls = palette[status] ?? "bg-white/5 text-gray-300 border-white/10";
  return <span className={`text-[9px] px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>;
}
