import { useState, useEffect, useRef, type ReactElement } from "react";
import { Play, Square, Send, Terminal, RefreshCw, CheckCircle, Clock, XCircle, Loader } from "lucide-react";
import { motion } from "framer-motion";
import { useInterval } from "../../hooks/useInterval";

interface SwarmTask {
  id?: string | number;
  title?: string;
  description?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface LogState {
  lines: string[];
  running: boolean;
}

const STATUS_ICON: Record<string, ReactElement> = {
  done: <CheckCircle size={14} className="text-emerald-400" />,
  pending: <Clock size={14} className="text-amber-400" />,
  running: <Loader size={14} className="text-blue-400 animate-spin" />,
  failed: <XCircle size={14} className="text-red-400" />,
};

const STATUS_BADGE: Record<string, string> = {
  done: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40",
  pending: "bg-amber-900/40 text-amber-300 border border-amber-700/40",
  running: "bg-blue-900/40 text-blue-300 border border-blue-700/40",
  failed: "bg-red-900/40 text-red-300 border border-red-700/40",
};

export default function SwarmPanel() {
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [log, setLog] = useState<LogState>({ lines: [], running: false });
  const [taskInput, setTaskInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);
  const [toast, setToast] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const fetchTasks = async () => {
    try {
      const r = await fetch("/api/swarm/tasks");
      const data = await r.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      const r = await fetch("/api/swarm/logs");
      const data: LogState = await r.json();
      setLog(data);
    } catch {}
  };

  useEffect(() => { fetchTasks(); fetchLogs(); }, []);
  useInterval(() => { fetchTasks(); fetchLogs(); }, 5000);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.lines]);

  const handleControl = async (action: "start" | "stop") => {
    setControlLoading(true);
    try {
      const r = await fetch("/api/swarm/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await r.json();
      showToast(data.message || (action === "start" ? "Swarm started" : "Swarm stopped"));
      fetchLogs();
    } catch {
      showToast("Control request failed");
    } finally {
      setControlLoading(false);
    }
  };

  const handleSubmitTask = async () => {
    if (!taskInput.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/swarm/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskInput.trim() }),
      });
      const data = await r.json();
      showToast(data.message || "Task submitted");
      setTaskInput("");
      setTimeout(fetchTasks, 2000);
    } catch {
      showToast("Failed to submit task");
    } finally {
      setSubmitting(false);
    }
  };

  const getTaskStatus = (task: SwarmTask): string => {
    const raw = String(task.status || "pending").toLowerCase();
    if (raw.includes("done") || raw.includes("complete")) return "done";
    if (raw.includes("run") || raw.includes("active")) return "running";
    if (raw.includes("fail") || raw.includes("error")) return "failed";
    return "pending";
  };

  const getTaskTitle = (task: SwarmTask): string => {
    return String(task.title || task.description || task.id || "Untitled task");
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(135deg, #0f1c2e 0%, #1a2d45 100%)" }}>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "#C9A84C", color: "#1E3A5F" }}
        >
          {toast}
        </motion.div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">OpenSwarm Control</h1>
            <p className="text-slate-400 text-sm mt-1">Autonomous agent orchestration</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${log.running ? "bg-emerald-900/50 text-emerald-300 border border-emerald-600/40" : "bg-slate-800/60 text-slate-400 border border-slate-600/40"}`}>
              <div className={`w-2 h-2 rounded-full ${log.running ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              {log.running ? "Running" : "Idle"}
            </div>
            <button
              onClick={() => handleControl(log.running ? "stop" : "start")}
              disabled={controlLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={log.running
                ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
                : { background: "#C9A84C", color: "#1E3A5F", border: "none" }
              }
            >
              {controlLoading ? <Loader size={16} className="animate-spin" /> : log.running ? <Square size={16} /> : <Play size={16} />}
              {log.running ? "Stop Swarm" : "Start Swarm"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-700/50 overflow-hidden" style={{ background: "rgba(30,58,95,0.4)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <h2 className="text-sm font-semibold text-white">Task Queue</h2>
              <button onClick={fetchTasks} className="text-slate-400 hover:text-white transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="divide-y divide-slate-700/30 max-h-80 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  No tasks found. OpenSwarm may not be initialised yet.
                </div>
              ) : (
                tasks.map((task, i) => {
                  const status = getTaskStatus(task);
                  return (
                    <div key={String(task.id ?? i)} className="px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors">
                      <div className="mt-0.5">{STATUS_ICON[status] || STATUS_ICON.pending}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{getTaskTitle(task)}</p>
                        {task.created_at && (
                          <p className="text-xs text-slate-500 mt-0.5">{String(task.created_at)}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[status] || STATUS_BADGE.pending}`}>
                        {status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 overflow-hidden" style={{ background: "rgba(30,58,95,0.4)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
              <Terminal size={14} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-white">Live Log</h2>
            </div>
            <div
              ref={logRef}
              className="p-4 h-80 overflow-y-auto font-mono text-xs space-y-1"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              {log.lines.length === 0 ? (
                <span className="text-slate-600">No output yet...</span>
              ) : (
                log.lines.map((line, i) => (
                  <div key={i} className="text-slate-300 leading-relaxed">
                    <span className="text-slate-600 select-none mr-2">{String(i + 1).padStart(2, "0")}</span>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 p-4" style={{ background: "rgba(30,58,95,0.4)" }}>
          <h2 className="text-sm font-semibold text-white mb-3">Submit New Task</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitTask()}
              placeholder="Describe the task for OpenSwarm..."
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 border border-slate-600/50 focus:outline-none focus:border-amber-500/60 transition-colors"
              style={{ background: "rgba(0,0,0,0.3)" }}
            />
            <button
              onClick={handleSubmitTask}
              disabled={submitting || !taskInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: "#C9A84C", color: "#1E3A5F" }}
            >
              {submitting ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
