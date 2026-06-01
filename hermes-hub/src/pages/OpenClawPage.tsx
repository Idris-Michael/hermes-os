import { useState, useEffect, useRef } from "react";
import { Play, Square, GitBranch } from "lucide-react";
import { useInterval } from "../hooks/useInterval";

export default function OpenClawPage() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [task, setTask] = useState("");
  const [installed, setInstalled] = useState<boolean | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/openclaw/status")
      .then((r) => r.json())
      .then((d) => { setRunning(d.running); setInstalled(true); })
      .catch(() => setInstalled(false));
  }, []);

  useInterval(() => {
    fetch("/api/openclaw/logs").then((r) => r.json()).then((d) => setLogs(d.lines || []));
  }, running ? 1000 : null);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const startRun = async () => {
    if (!task.trim()) return;
    await fetch("/api/openclaw/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
    setRunning(true);
    setLogs([]);
  };

  const stopRun = async () => {
    await fetch("/api/openclaw/stop", { method: "POST" });
    setRunning(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
          🦀
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">OPENCLAW</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {installed === false ? (
              <span className="badge badge-red">NOT DETECTED</span>
            ) : running ? (
              <span className="badge badge-green">RUNNING</span>
            ) : (
              <span className="badge badge-grey">IDLE</span>
            )}
          </div>
        </div>
      </div>

      {installed === false && (
        <div className="os-card p-4 border-red-500/20">
          <p className="text-sm text-gray-400">OpenClaw CLI not detected. Install it to use this section.</p>
          <code className="text-xs text-red-400 font-mono mt-2 block">npm install -g openclaw</code>
        </div>
      )}

      {/* Task input */}
      <div className="os-card p-4 space-y-3">
        <div className="section-label">Task</div>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe the task for OpenClaw to execute..."
          rows={3}
          className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none resize-none font-mono border border-white/10 rounded-lg p-3 focus:border-red-500/40 transition-colors"
        />
        <div className="flex gap-2">
          <button
            onClick={startRun}
            disabled={running || !task.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <Play size={13} /> RUN
          </button>
          <button
            onClick={stopRun}
            disabled={!running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Square size={13} /> STOP
          </button>
        </div>
      </div>

      {/* Log stream */}
      <div className="os-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <div className="section-label">Output</div>
          <div className="flex items-center gap-1">
            {running && <div className="w-1.5 h-1.5 rounded-full bg-red-400 pulse-dot" />}
            <span className="text-xs text-gray-600">{logs.length} lines</span>
          </div>
        </div>
        <div className="h-64 overflow-y-auto p-4 font-mono text-xs text-gray-400" style={{ background: "#020804" }}>
          {logs.length === 0 ? (
            <span className="text-gray-600">No output yet. Run a task to see logs here.</span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="leading-relaxed whitespace-pre-wrap">
                <span className="text-gray-600 mr-2 select-none">{String(i + 1).padStart(3, " ")}</span>
                <span style={{ color: line.includes("[error]") || line.includes("Error") ? "#f87171" : line.includes("[task exited: 0]") ? "#4ade80" : "#9ca3af" }}>{line}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Diff viewer placeholder */}
      <div className="os-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch size={14} className="text-gray-500" />
          <div className="section-label">Git Diff</div>
        </div>
        <p className="text-sm text-gray-600">Diff will appear here after OpenClaw makes changes to the workspace.</p>
      </div>
    </div>
  );
}
