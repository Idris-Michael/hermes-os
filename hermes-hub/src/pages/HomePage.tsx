import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { RefreshCw, ExternalLink, Zap, Brain, Activity, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import WebGLBackground from "../components/WebGLBackground";
import ParallaxTiltCard from "../components/ParallaxTiltCard";
import { useMemoryGraph } from "../hooks/queries";

// MemoryGraph3D pulls in three.js (~1.3 MB). Lazy-load it so HomePage paints
// without waiting on the three chunk, and skip mounting it entirely until the
// memory data has arrived.
const MemoryGraph3D = lazy(() => import("../components/MemoryGraph3D"));

// Cap nodes fed to the O(n²) settle physics. 60 keeps the one-time freeze
// under ~50ms even on a slow machine while still showing a meaningful graph.
const VIZ_NODE_CAP = 60;

// ── types ────────────────────────────────────────────────────────────────────
interface MemNode { id: string; name: string; type: string; }

const EMPTY_MEM_NODES: MemNode[] = [];

// ── subscriptions ─────────────────────────────────────────────────────────────
const SUBSCRIPTIONS = [
  { name: "Claude Max 20x", provider: "ANTHROPIC · OAUTH", icon: "A", iconBg: "#D4A017", cost: 200 },
  { name: "ChatGPT Plus", provider: "OPENAI · CHATGPT", icon: "C", iconBg: "#10a37f", cost: 20 },
  { name: "Codex", provider: "OPENAI · CLI AGENT", icon: "C", iconBg: "#3b82f6", cost: 0, note: "— credit" },
];
const USAGE_BARS = [
  { label: "5-HOUR LIMIT", used: 9, max: 900, pct: 1, color: "#10b981" },
  { label: "WEEKLY · ALL MODELS", used: 426, max: 5000, pct: 9, color: "#f59e0b" },
  { label: "SONNET ONLY", used: 21, max: 5000, pct: 0, color: "#10b981" },
  { label: "3H", used: 0, max: 80, pct: 0, color: "#10b981" },
];
const totalSpend = SUBSCRIPTIONS.reduce((s, x) => s + x.cost, 0);

// ── quick-nav tiles ───────────────────────────────────────────────────────────
const QUICK_NAV = [
  { to: "/agents/hermes", label: "Hermes Agent", sub: "AI command interface", icon: "⚡", color: "#D4A017" },
  { to: "/memory", label: "Memory Graph", sub: `nodes in constellation`, icon: "🧠", color: "#22c55e" },
  { to: "/profiles", label: "Deck Profiles", sub: "10 card personas active", icon: "♠", color: "#818cf8" },
  { to: "/voiceover", label: "Voiceover", sub: "Supertonic TTS studio", icon: "🎙️", color: "#f472b6" },
];

// ── greeting ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Live Terminal Logs ────────────────────────────────────────────────────────
const TERMINAL_LOGS = [
  "[SYS] Initializing swarm protocols...",
  "[AUTH] Validating tokens with backend...",
  "[OK] Connection to OpenSwarm established on port 8642.",
  "[MEM] Loaded 144 nodes into memory constellation.",
  "[AGENT] Hermes: Ready for commands.",
  "[JOB] Processing background task #8911... DONE",
  "[WATCH] Tracking local file system changes.",
  "[SYS] Awaiting input."
];

// ══════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"subscriptions" | "tokens">("subscriptions");
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Memory nodes from the shared cache. EMPTY_MEM_NODES is a stable reference
  // so MemoryGraph3D's `useMemo(settle, [nodes])` doesn't re-run a 216² physics
  // loop on every render while data is undefined or briefly empty.
  const { data: memoryData } = useMemoryGraph();
  const memNodes = useMemo<MemNode[]>(() => {
    const all = (memoryData?.nodes as unknown as MemNode[]) ?? EMPTY_MEM_NODES;
    if (all.length <= VIZ_NODE_CAP) return all;
    // Keep the memory-core anchor, then sample the rest by recency.
    const core = all.filter((n) => n.type === "memory core");
    const rest = all.filter((n) => n.type !== "memory core").slice(0, VIZ_NODE_CAP - core.length);
    return [...core, ...rest];
  }, [memoryData]);

  // simulated terminal stream
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < TERMINAL_LOGS.length) {
        setTerminalLines(prev => [...prev, TERMINAL_LOGS[index]]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white overflow-hidden">
      <WebGLBackground showModel={false} />
      
      {/* Decorative SVG Data Flow Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.15 }}>
        <path d="M200 100 C 300 100, 400 300, 600 300 S 800 500, 1000 500" 
          fill="none" stroke="#00ffcc" strokeWidth="2" strokeDasharray="10 20"
          style={{ animation: "dash 20s linear infinite" }} />
        <path d="M1000 150 C 800 150, 600 400, 400 400 S 200 600, 0 600" 
          fill="none" stroke="#ff00cc" strokeWidth="2" strokeDasharray="5 15"
          style={{ animation: "dash 15s linear infinite reverse" }} />
      </svg>
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }
      `}</style>

      <div className="relative z-10 flex flex-col w-full h-full bg-black/40 backdrop-blur-sm overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6 w-full">
          
          {/* ── Greeting header ── */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 10px #22c55e, 0 0 20px #22c55e50" }} />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-30" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#f0f0f0" }}>
                  {getGreeting()},{" "}
                  <span style={{
                    color: "#D4A017",
                    textShadow: "0 0 20px #D4A01740, 0 0 40px #D4A01720",
                  }}>Idris.</span>
                </h1>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{
                  background: "rgba(212,160,23,0.12)",
                  color: "#D4A017",
                  border: "1px solid rgba(212,160,23,0.3)",
                  boxShadow: "0 0 12px rgba(212,160,23,0.15)",
                }}>
                  INTELLIGENCE HUB
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 ml-5">
                <span className="text-emerald-400">●</span>
                <span className="font-mono text-gray-600">Hermes</span>
                <span>·</span>
                <span>Claude Code OS · All systems nominal</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              {["TODAY", "7 DAYS", "28 DAYS"].map((d) => (
                <button key={d}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: d === "28 DAYS" ? "rgba(212,160,23,0.12)" : "transparent",
                    color: d === "28 DAYS" ? "#D4A017" : "#6b7280",
                    border: d === "28 DAYS" ? "1px solid rgba(212,160,23,0.3)" : "1px solid transparent",
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* ── Quick-nav tiles ── */}
          <div className="grid grid-cols-4 gap-3">
            {QUICK_NAV.map((item) => (
              <ParallaxTiltCard key={item.to}>
                <button
                  onClick={() => navigate(item.to)}
                  onMouseEnter={() => setHoveredNav(item.to)}
                  onMouseLeave={() => setHoveredNav(null)}
                  className="relative w-full overflow-hidden rounded-xl p-4 text-left transition-all duration-200"
                  style={{
                    background: hoveredNav === item.to
                      ? `linear-gradient(135deg, ${item.color}30 0%, ${item.color}10 100%)`
                      : "transparent",
                    border: `1px solid ${hoveredNav === item.to ? item.color + "80" : "rgba(255,255,255,0.0)"}`,
                    boxShadow: hoveredNav === item.to ? `0 0 20px ${item.color}30, inset 0 0 20px ${item.color}10` : "none",
                  }}>
                  <div className="absolute right-2 bottom-1 text-4xl opacity-10 select-none" style={{ lineHeight: 1 }}>
                    {item.icon}
                  </div>
                  <div className="text-2xl mb-2" style={{ filter: `drop-shadow(0 0 6px ${item.color}80)` }}>
                    {item.icon}
                  </div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: item.color + "cc" }}>{item.sub}</div>
                </button>
              </ParallaxTiltCard>
            ))}
          </div>

          {/* ── 3 Metric Cards ── */}
          <div className="grid grid-cols-3 gap-4">
            <ParallaxTiltCard>
              <div className="relative overflow-hidden rounded-xl p-5 cursor-pointer h-full cc-press cc-glass cc-glow-gold"
                style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.06) 0%, rgba(212,160,23,0.02) 100%)", borderColor: "rgba(212,160,23,0.15)" }}>
                <div className="section-label mb-2" style={{ color: "#9ca3af" }}>AI SPEND</div>
                <div className="text-4xl font-bold" style={{ color: "#D4A017", textShadow: "0 0 30px rgba(212,160,23,0.5)" }}>
                  ${totalSpend}
                </div>
                <div className="text-xs text-gray-400 mt-1">last 28 days</div>
              </div>
            </ParallaxTiltCard>
            <ParallaxTiltCard>
              <div className="relative overflow-hidden rounded-xl p-5 cursor-pointer h-full cc-press cc-glass cc-glow-emerald"
                style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.02) 100%)", borderColor: "rgba(16,185,129,0.15)" }}>
                <div className="section-label mb-2" style={{ color: "#9ca3af" }}>
                  <Zap size={10} className="inline mr-1" />SKILLS ACTIVE
                </div>
                <div className="text-4xl font-bold text-emerald-400" style={{ textShadow: "0 0 30px rgba(16,185,129,0.5)" }}>
                  69
                </div>
                <div className="text-xs text-gray-400 mt-1">skills detected</div>
              </div>
            </ParallaxTiltCard>
            <ParallaxTiltCard>
              <div className="relative overflow-hidden rounded-xl p-5 cursor-pointer h-full cc-press cc-glass cc-glow-violet"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(124,58,237,0.02) 100%)", borderColor: "rgba(129,140,248,0.15)" }}>
                <div className="section-label mb-2" style={{ color: "#9ca3af" }}>
                  <Activity size={10} className="inline mr-1" />ACTIVITY
                </div>
                <div className="text-4xl font-bold text-indigo-300" style={{ textShadow: "0 0 30px rgba(129,140,248,0.5)" }}>
                  20,446
                </div>
                <div className="text-xs text-gray-400 mt-1">tokens last 7d · 20 projects</div>
              </div>
            </ParallaxTiltCard>
          </div>

          {/* ── Main Layout: Memory Graph & Subscriptions ── */}
          <div className="grid grid-cols-[2fr_1fr] gap-6">
            
            {/* ── 3D Memory Graph ── */}
            <ParallaxTiltCard className="flex flex-col">
              <div className="flex-1 flex flex-col overflow-hidden h-[320px]">
                <div className="flex items-center justify-between px-5 py-3 shrink-0 bg-black/30 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <Brain size={14} style={{ color: "#22c55e", filter: "drop-shadow(0 0 6px #22c55e)" }} />
                    <span className="section-label" style={{ color: "#9ca3af" }}>Memory Constellation</span>
                  </div>
                  <button
                    onClick={() => navigate("/memory")}
                    className="flex items-center gap-1.5 text-xs transition-all px-3 py-1 rounded-lg hover:bg-white/10 cc-press"
                    style={{ color: "#D4A017", border: "1px solid rgba(212,160,23,0.2)" }}
                  >
                    Expand <ExternalLink size={10} />
                  </button>
                </div>

                <div className="relative flex-1 bg-black/10">
                  {memNodes.length > 0 ? (
                    <Suspense fallback={
                      <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-gray-500">
                        Loading 3D engine...
                      </div>
                    }>
                      <MemoryGraph3D nodes={memNodes} />
                    </Suspense>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-gray-500">
                      Loading constellation...
                    </div>
                  )}
                </div>
              </div>
            </ParallaxTiltCard>

            {/* ── Live Agent Stream Terminal ── */}
            <ParallaxTiltCard className="flex flex-col">
              <div className="flex-1 overflow-hidden flex flex-col h-[320px]">
                <div className="flex items-center gap-2 px-5 py-3 shrink-0 bg-black/30 border-b border-white/5">
                  <Terminal size={14} className="text-emerald-400" />
                  <span className="section-label text-emerald-400">Swarm Terminal</span>
                </div>
                <div 
                  ref={terminalRef}
                  className="p-4 flex-1 overflow-y-auto font-mono text-[10px] sm:text-[11px] leading-relaxed tracking-wider scroll-smooth bg-black/20"
                  style={{ color: "#34d399", textShadow: "0 0 5px rgba(52,211,153,0.3)" }}
                >
                  {terminalLines.map((line, i) => (
                    <div key={i} className="mb-1 opacity-90 hover:opacity-100 transition-opacity">
                      {line}
                    </div>
                  ))}
                  <div className="animate-pulse inline-block w-2 h-3 bg-emerald-400 mt-1" />
                </div>
              </div>
            </ParallaxTiltCard>
          </div>
          
          {/* ── Subscriptions / Tokens ── */}
          <ParallaxTiltCard>
            <div className="overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-0 bg-black/10 border-b border-white/5">
                <div className="flex gap-1">
                  {(["subscriptions", "tokens"] as const).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className="text-xs px-4 py-2.5 font-semibold uppercase tracking-wider transition-all cc-press"
                      style={{
                        color: activeTab === tab ? "#fff" : "#6b7280",
                        borderBottom: activeTab === tab ? "2px solid #D4A017" : "2px solid transparent",
                        background: "transparent",
                        boxShadow: activeTab === tab ? "inset 0 -8px 16px rgba(212,160,23,0.04)" : "none",
                      }}>
                      {tab === "subscriptions" ? "SUBSCRIPTIONS" : "TOKEN LIMITS"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 pb-2">
                  <RefreshCw size={10} />
                  <span>SYNC · 20:04</span>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3">
                {activeTab === "subscriptions" ? (
                  <div className="grid grid-cols-3 gap-3">
                    {SUBSCRIPTIONS.map((sub) => (
                      <div key={sub.name} className="rounded-xl p-4 cc-press cc-glass">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black"
                            style={{ background: sub.iconBg, boxShadow: `0 0 12px ${sub.iconBg}60` }}>
                            {sub.icon}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{sub.name}</div>
                            <div className="text-xs text-gray-400">{sub.provider}</div>
                          </div>
                        </div>
                        {sub.cost > 0 ? (
                          <div className="text-xl font-bold text-white">${sub.cost}<span className="text-xs text-gray-500 font-normal"> / mo</span></div>
                        ) : (
                          <div className="text-sm text-gray-500">{sub.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {USAGE_BARS.map((bar) => (
                      <div key={bar.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-gray-400 tracking-wider">{bar.label}</span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">{bar.used.toLocaleString()} / {bar.max.toLocaleString()}</span>
                            <span className="font-semibold" style={{ color: bar.color }}>{bar.pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(bar.pct, bar.used > 0 ? 1 : 0)}%`,
                              background: `linear-gradient(90deg, ${bar.color}80, ${bar.color})`,
                              boxShadow: bar.used > 0 ? `0 0 8px ${bar.color}80` : "none",
                            }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ParallaxTiltCard>

          {/* ── System status row ── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "HERMES AGENT", status: "OFFLINE", color: "#f97316", sub: "port 8642" },
              { label: "PAPERCLIP", status: "RUNNING", color: "#22c55e", sub: "port 3100" },
              { label: "MEMORY", status: `${memNodes.length} nodes`, color: "#818cf8", sub: "local fs" },
              { label: "TTS ENGINE", status: "READY", color: "#2dd4bf", sub: "supertonic" },
            ].map((sys) => (
              <ParallaxTiltCard key={sys.label}>
                <div className="rounded-xl px-4 py-3 cc-glass h-full">
                  <div className="section-label mb-1 text-gray-400" style={{ fontSize: 8 }}>{sys.label}</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: sys.color, boxShadow: `0 0 6px ${sys.color}` }} />
                    <span className="text-xs font-semibold" style={{ color: sys.color }}>{sys.status}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{sys.sub}</div>
                </div>
              </ParallaxTiltCard>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
