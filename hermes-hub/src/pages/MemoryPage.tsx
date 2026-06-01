import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import WebGLBackground from "../components/WebGLBackground";
import ParallaxTiltCard from "../components/ParallaxTiltCard";
import Constellation3D from "../components/Constellation3D";
import { useMemoryGraph, useConstellation } from "../hooks/queries";


interface MemNode {
  id: string;
  name: string;
  type: string;
  description: string;
  path: string;
  mtime: number;
}
interface MemSignal { name: string; mtime: number; ago: string; }
interface MemStats  { total: number; stale: number; missing: number; }

// ── type config ──────────────────────────────────────────────────────────────
const TC: Record<string, { color: string; r: number }> = {
  "memory core": { color: "#22c55e", r: 18 },
  workspace:     { color: "#9ca3af", r: 7  },
  workspaces:    { color: "#9ca3af", r: 7  },
  decisions:     { color: "#60a5fa", r: 9  },
  sessions:      { color: "#818cf8", r: 7  },
  skills:        { color: "#f472b6", r: 8  },
  stale:         { color: "#f97316", r: 7  },
  missing:       { color: "#6b7280", r: 5  },
  feedback:      { color: "#f59e0b", r: 9  },
  project:       { color: "#34d399", r: 9  },
  reference:     { color: "#a78bfa", r: 8  },
  user:          { color: "#60a5fa", r: 9  },
  obsidian:      { color: "#7c3aed", r: 8  },
};

function cfg(type: string) {
  return TC[type.toLowerCase()] ?? TC.workspace;
}

// hex → [r,g,b]
function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// ── animated force graph on canvas ──────────────────────────────────────────
interface SimNode extends MemNode {
  x: number; y: number;
  vx: number; vy: number;
  fx?: number; fy?: number; // pinned when dragging
}

function useAnimatedForce(nodes: MemNode[], w: number, h: number) {
  const simRef  = useRef<SimNode[]>([]);
  const frameRef = useRef<number>(0);
  const tickRef  = useRef(0);

  // seed once when node list changes shape
  useEffect(() => {
    if (!nodes.length || !w || !h) return;
    const existing = new Map(simRef.current.map(n => [n.id, n]));
    simRef.current = nodes.map(n => {
      const e = existing.get(n.id);
      if (e) return { ...n, x: e.x, y: e.y, vx: e.vx, vy: e.vy };
      if (n.type === "memory core") return { ...n, x: w * 0.5, y: h * 0.5, vx: 0, vy: 0 };
      const angle = Math.random() * Math.PI * 2;
      const dist  = 60 + Math.random() * (Math.min(w, h) * 0.4);
      return { ...n, x: w * 0.5 + Math.cos(angle) * dist, y: h * 0.5 + Math.sin(angle) * dist, vx: 0, vy: 0 };
    });
  }, [nodes.length, w, h]);

  return { simRef, frameRef, tickRef };
}

// ── main component ───────────────────────────────────────────────────────────
const LEGEND = [
  { type: "memory core", label: "Memory core" },
  { type: "project",     label: "Project"     },
  { type: "decisions",   label: "Decision"    },
  { type: "sessions",    label: "Session"     },
  { type: "skills",      label: "Skill"       },
  { type: "feedback",    label: "Feedback"    },
  { type: "obsidian",    label: "Obsidian"    },
  { type: "stale",       label: "Stale"       },
  { type: "missing",     label: "Missing"     },
];

const TECH_STACK = [
  { name: "OpenAI Codex",    sub: "Codex · chatgpt",   icon: "⚙️", color: "#10a37f" },
  { name: "Obsidian",        sub: "vault linked",       icon: "💎", color: "#7c3aed" },
  { name: "OpenClaw",        sub: "v2026.3.23-2",       icon: "🦀", color: "#ef4444" },
  { name: "Youtube",         sub: "MCP · sdio",         icon: "▶️", color: "#ff0000" },
  { name: "Codex Plugin",    sub: "plugin",             icon: "C",  color: "#3b82f6" },
  { name: "Gemini Plugin",   sub: "plugin",             icon: "G",  color: "#4285f4" },
  { name: "Vercel",          sub: "plugin",             icon: "▲",  color: "#ffffff" },
  { name: "Gemini",          sub: "connector",          icon: "G",  color: "#fbbc04" },
  { name: "Google Calendar", sub: "connector",          icon: "📅", color: "#1a73e8" },
  { name: "Gamma",           sub: "connector",          icon: "G",  color: "#6366f1" },
  { name: "Mercury",         sub: "connector",          icon: "M",  color: "#D4A017" },
  { name: "Fireflies",       sub: "connector",          icon: "F",  color: "#f472b6" },
];

const EMPTY_MEM_NODES: MemNode[] = [];
const EMPTY_SIGNALS: MemSignal[] = [];
const DEFAULT_STATS: MemStats = { total: 0, stale: 0, missing: 0 };

export default function MemoryPage() {
  const [filter,  setFilter]  = useState<string | null>(null);
  const [hovered, setHovered] = useState<SimNode | null>(null);
  const [selected,setSelected]= useState<SimNode | null>(null);
  const [search,  setSearch]  = useState("");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: SimNode } | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 760 });

  // Shared TanStack Query caches — read directly, no useState mirror (the
  // mirror caused a re-render loop because StrictMode + ?? [] returned a new
  // array reference each render, which destabilised useAnimatedForce).
  const { data: memoryData } = useMemoryGraph();
  const { data: constellationQueryData } = useConstellation();

  const nodes      = (memoryData?.nodes   ?? EMPTY_MEM_NODES) as unknown as MemNode[];
  const signals    = (memoryData?.signals ?? EMPTY_SIGNALS) as MemSignal[];
  const stats      = (memoryData?.stats   ?? DEFAULT_STATS) as MemStats;
  const constellationData = constellationQueryData ?? null;

  const { simRef, frameRef, tickRef } = useAnimatedForce(nodes, dims.w, dims.h);

  // drag state
  const dragRef = useRef<{ node: SimNode; ox: number; oy: number } | null>(null);

  // ── resize ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const upd = () => { if (wrapRef.current) setDims({ w: wrapRef.current.clientWidth, h: 760 }); };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  // ── animation loop ──────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sim = simRef.current;
    if (!sim.length) { frameRef.current = requestAnimationFrame(drawFrame); return; }
    // sync canvas pixel size to layout size every frame
    const rect = canvas.getBoundingClientRect();
    const w = rect.width  || canvas.width  || 900;
    const h = rect.height || canvas.height || 480;
    if (canvas.width !== w)  canvas.width  = w;
    if (canvas.height !== h) canvas.height = h;
    tickRef.current++;
    const t = tickRef.current;

    // ── physics ────────────────────────────────────────────────────────────
    const REPEL = 2800, ATTRACT = 0.004, DAMP = 0.82, EDGE_ATTRACT = 0.006;
    const activeTypes = filter ? new Set([filter]) : null;

    for (let i = 0; i < sim.length; i++) {
      const a = sim[i];
      if (a.fx !== undefined) continue; // pinned while dragging
      for (let j = i + 1; j < sim.length; j++) {
        const b = sim[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist2 = dx * dx + dy * dy || 1;
        const dist  = Math.sqrt(dist2);
        const f = REPEL / dist2;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
      // weak attraction to centre
      a.vx += (w * 0.5 - a.x) * ATTRACT;
      a.vy += (h * 0.5 - a.y) * ATTRACT;
      // edge spring
      a.vx += (w * 0.5 - a.x) * EDGE_ATTRACT * 0.2;
      a.vy += (h * 0.5 - a.y) * EDGE_ATTRACT * 0.2;
      // gentle drift
      a.vx += (Math.random() - 0.5) * 0.08;
      a.vy += (Math.random() - 0.5) * 0.08;
      a.vx *= DAMP; a.vy *= DAMP;
      a.x = Math.max(20, Math.min(w - 20, a.x + a.vx));
      a.y = Math.max(20, Math.min(h - 20, a.y + a.vy));
    }

    // ── draw ───────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, w, h);

    // background (transparent to let WebGLBackground show through)

    // subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < w; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy < h; gy += 60) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    const visible = activeTypes
      ? sim.filter(n => activeTypes.has(n.type.toLowerCase()) || n.type === "memory core")
      : sim;

    const searchLower = search.toLowerCase();
    const searchActive = searchLower.length > 1;

    // ── edges ──────────────────────────────────────────────────────────────
    for (let i = 0; i < visible.length; i++) {
      const a = visible[i];
      const neighbors = visible
        .filter((_, j) => j !== i)
        .sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y))
        .slice(0, 3);

      for (const b of neighbors) {
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > 220) continue;
        const alpha = Math.max(0, (1 - dist / 220) * 0.18);
        const [r, g, bl] = hexRgb(cfg(a.type).color);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    // ── nodes ──────────────────────────────────────────────────────────────
    for (const n of visible) {
      const c = cfg(n.type);
      const [r, g, bl] = hexRgb(c.color);
      const isCore   = n.type === "memory core";
      const isHov    = hovered?.id === n.id;
      const isSel    = selected?.id === n.id;
      const isDimmed = searchActive && !n.name.toLowerCase().includes(searchLower) && !isCore;
      const pulse    = isCore ? 1 + 0.15 * Math.sin(t * 0.04) : 1;
      const rad      = c.r * pulse;

      if (isDimmed) { ctx.globalAlpha = 0.12; }

      // outer glow
      const go = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, rad * (isHov ? 7 : 5));
      go.addColorStop(0,   `rgba(${r},${g},${bl},${isHov ? 0.5 : 0.28})`);
      go.addColorStop(0.4, `rgba(${r},${g},${bl},${isHov ? 0.2 : 0.1})`);
      go.addColorStop(1,   `rgba(${r},${g},${bl},0)`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, rad * (isHov ? 7 : 5), 0, Math.PI * 2);
      ctx.fillStyle = go;
      ctx.fill();

      // mid halo for core / selected
      if (isCore || isSel) {
        const halo = ctx.createRadialGradient(n.x, n.y, rad * 0.8, n.x, n.y, rad * 2.5);
        halo.addColorStop(0, `rgba(${r},${g},${bl},0.25)`);
        halo.addColorStop(1, `rgba(${r},${g},${bl},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, rad * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      // core circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${bl},0.92)`;
      ctx.fill();

      // selected ring
      if (isSel) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, rad + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${bl},0.9)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // label for large nodes or hovered
      if (rad >= 8 || isHov) {
        ctx.font = isHov ? "bold 10px 'JetBrains Mono', monospace" : "9px 'JetBrains Mono', monospace";
        ctx.fillStyle = isHov ? "#ffffff" : `rgba(${r},${g},${bl},0.85)`;
        ctx.textAlign = "center";
        const label = n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name;
        ctx.fillText(label, n.x, n.y + rad + 12);
      }
    }

    frameRef.current = requestAnimationFrame(drawFrame);
  }, [filter, hovered, selected, search, simRef, frameRef, tickRef]);

  useEffect(() => {
    if (viewMode === "2d") {
      frameRef.current = requestAnimationFrame(drawFrame);
    }
    return () => cancelAnimationFrame(frameRef.current);
  }, [drawFrame, viewMode]);

  // ── mouse interactions ───────────────────────────────────────────────────
  const getNodeAt = useCallback((cx: number, cy: number): SimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = cx - rect.left, my = cy - rect.top;
    const sim = simRef.current;
    for (let i = sim.length - 1; i >= 0; i--) {
      const n = sim[i];
      const r = cfg(n.type).r + 6;
      if (Math.hypot(n.x - mx, n.y - my) < r) return n;
    }
    return null;
  }, [simRef]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      dragRef.current.node.fx = mx;
      dragRef.current.node.fy = my;
      dragRef.current.node.x  = mx;
      dragRef.current.node.y  = my;
      return;
    }
    const n = getNodeAt(e.clientX, e.clientY);
    setHovered(n);
    if (n) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: n });
    } else {
      setTooltip(null);
    }
    if (canvasRef.current) canvasRef.current.style.cursor = n ? "pointer" : "default";
  }, [getNodeAt]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const n = getNodeAt(e.clientX, e.clientY);
    if (!n) return;
    dragRef.current = { node: n, ox: e.clientX - n.x, oy: e.clientY - n.y };
  }, [getNodeAt]);

  const onMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current.node.fx = undefined;
      dragRef.current.node.fy = undefined;
      dragRef.current = null;
    }
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    const n = getNodeAt(e.clientX, e.clientY);
    setSelected(s => s?.id === n?.id ? null : n);
  }, [getNodeAt]);

  const handleSelect3DNode = useCallback((node: any) => {
    setSelected({
      id: node.id,
      name: node.label,
      type: node.group === "projects" ? "project" : node.group === "skills" ? "skills" : "decisions",
      description: node.description || `Tactical memory entity indexed in Hermes under "${node.label}".`,
      path: node.path || `03 - SYSTEM/constellation.json ➔ ${node.id}`,
      mtime: Date.now(),
      x: 0, y: 0, vx: 0, vy: 0
    });
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white overflow-hidden">
      <WebGLBackground showModel={false} />

      {/* Decorative SVG Data Flow Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.15 }}>
        <path d="M150 150 C 300 250, 450 50, 600 150 S 750 350, 900 250" 
          fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="10 15"
          style={{ animation: "dash 25s linear infinite" }} />
        <path d="M900 350 C 750 250, 600 450, 450 350 S 300 150, 150 250" 
          fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="5 10"
          style={{ animation: "dash 18s linear infinite reverse" }} />
      </svg>
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }
      `}</style>

      <div className="relative z-10 flex flex-col w-full h-full bg-black/40 backdrop-blur-sm overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto space-y-6 w-full flex flex-col h-full">

          {/* ── header ── */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 10px #22c55e" }} />
                <div className="section-label mb-0">Memory</div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
                Your Memory <span className="text-[#D4A017] drop-shadow-[0_0_15px_rgba(212,160,23,0.3)]">Constellation</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* search */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 backdrop-blur-md">
                <Search size={12} className="text-[#2dd4bf]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search nodes…"
                  className="bg-transparent text-xs text-gray-300 placeholder-gray-600 outline-none w-36"
                />
                {search && <button onClick={() => setSearch("")}><X size={11} className="text-gray-500 hover:text-white" /></button>}
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-black/50 border border-white/10 rounded-lg p-0.5 backdrop-blur-md">
                <button
                  onClick={() => setViewMode("2d")}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider transition-all uppercase ${
                    viewMode === "2d"
                      ? "bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30"
                      : "text-gray-400 hover:text-white border border-transparent"
                  }`}
                >
                  2D Network
                </button>
                <button
                  onClick={() => setViewMode("3d")}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider transition-all uppercase ${
                    viewMode === "3d"
                      ? "bg-[#D4A017]/20 text-[#D4A017] font-bold border border-[#D4A017]/30 animate-pulse"
                      : "text-gray-400 hover:text-white border border-transparent"
                  }`}
                  style={{ textShadow: viewMode === "3d" ? "0 0 8px #D4A017" : "" }}
                >
                  3D Stellar
                </button>
              </div>

              <button className="flex items-center gap-1 text-xs text-[#2dd4bf] hover:text-white transition-colors bg-[#2dd4bf]/10 border border-[#2dd4bf]/30 px-3 py-1.5 rounded-lg">
                Open map <ExternalLink size={11} />
              </button>
            </div>
          </div>

          {/* ── canvas area wrapped in a beautiful glass frame ── */}
          <div
            ref={wrapRef}
            className="relative rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden shadow-2xl"
            style={{ height: 900 }}
          >
            {viewMode === "3d" && constellationData ? (
              <Constellation3D
                nodes={constellationData.nodes}
                links={constellationData.links}
                onSelectNode={handleSelect3DNode}
                selectedNodeId={selected?.id}
                filter={filter}
              />
            ) : (
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "100%" }}
                onMouseMove={onMouseMove}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onClick={onClick}
              />
            )}

            {/* NODE LEGEND */}
            <div className="absolute top-3 left-3 z-10 space-y-1.5 bg-black/60 border border-white/10 rounded-xl p-3 backdrop-blur-lg shadow-xl">
              <div className="section-label mb-1.5" style={{ fontSize: 9, color: "#D4A017" }}>NODE LEGEND</div>
              {LEGEND.map(l => (
                <button
                  key={l.type}
                  onClick={() => setFilter(f => f === l.type ? null : l.type)}
                  className="flex items-center gap-2 w-full text-left transition-opacity hover:opacity-80"
                  style={{ opacity: filter && filter !== l.type ? 0.35 : 1 }}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg(l.type).color, boxShadow: `0 0 8px ${cfg(l.type).color}` }} />
                  <span style={{ color: filter === l.type ? "#fff" : "#9ca3af", fontSize: 10, fontFamily: "JetBrains Mono" }}>{l.label}</span>
                </button>
              ))}
              {filter && (
                <button onClick={() => setFilter(null)} className="text-xs mt-1 w-full text-center py-1 rounded bg-[#D4A017]/10 border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017]/20 transition-all" style={{ fontSize: 9 }}>
                  Clear Filter
                </button>
              )}
            </div>

            {/* LATEST SIGNALS */}
            <div className="absolute top-3 right-3 z-10 w-56 bg-black/60 border border-white/10 rounded-xl p-3 backdrop-blur-lg shadow-xl">
              <div className="section-label mb-2.5" style={{ fontSize: 9, color: "#2dd4bf" }}>LATEST SIGNALS</div>
              {(signals.length ? signals : [
                { name: "Content Pipeline.md", ago: "recently" },
                { name: "Mount Severus OS",     ago: "recently" },
                { name: "Welcome.md",           ago: "recently" },
              ] as { name: string; ago: string }[]).slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 mb-2 hover:bg-white/5 p-1 rounded transition-colors">
                  <div className="w-2 h-2 rounded-full mt-1 shrink-0 bg-emerald-400" style={{ boxShadow: "0 0 6px #22c55e" }} />
                  <div className="min-w-0">
                    <div className="text-xs text-emerald-300 font-mono truncate max-w-[170px]">{s.name}</div>
                    <div style={{ fontSize: 9, color: "#6b7280" }}>{(s as MemSignal).ago ?? (s as { ago: string }).ago}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* STATS bottom-left */}
            <div className="absolute bottom-3 left-3 z-10 flex gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md">
                <span className="text-emerald-400 font-bold text-sm">{nodes.length}</span>
                <span className="text-gray-400 text-xs ml-1 font-mono">nodes</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md">
                <span className="text-orange-400 font-bold text-sm">{stats.stale}</span>
                <span className="text-gray-400 text-xs ml-1 font-mono">stale</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md">
                <span className="text-gray-400 font-bold text-sm">{stats.missing}</span>
                <span className="text-gray-500 text-xs ml-1 font-mono">missing</span>
              </div>
            </div>

            {/* filter pills bottom-centre */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {[
                { type: "decisions", label: "Decisions" },
                { type: "sessions",  label: "Sessions"  },
                { type: "skills",    label: "Skills"    },
                { type: "obsidian",  label: "Obsidian"  },
                { type: "project",   label: "Projects"  },
              ].map(f => {
                const color = cfg(f.type).color;
                const active = filter === f.type;
                return (
                  <button key={f.type} onClick={() => setFilter(v => v === f.type ? null : f.type)}
                    className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all"
                    style={{
                      background: active ? color + "20" : "rgba(0,0,0,0.6)",
                      color:      active ? color        : "#888",
                      border:     `1px solid ${active ? color + "60" : "rgba(255,255,255,0.08)"}`,
                      boxShadow:  active ? `0 0 10px ${color}20` : "none",
                    }}>
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Tooltip */}
            {tooltip && !selected && (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  left: tooltip.x + 14, top: tooltip.y - 10,
                  background: "rgba(0,0,0,0.85)",
                  border: `1px solid ${cfg(tooltip.node.type).color}80`,
                  borderRadius: 8, padding: "8px 12px",
                  boxShadow: `0 0 20px ${cfg(tooltip.node.type).color}30`,
                  backdropFilter: "blur(8px)",
                  maxWidth: 220,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg(tooltip.node.type).color, boxShadow: `0 0 8px ${cfg(tooltip.node.type).color}` }} />
                  <span className="text-white text-xs font-semibold">{tooltip.node.name}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: cfg(tooltip.node.type).color }}>{tooltip.node.type}</div>
                {tooltip.node.description && <div className="text-xs text-gray-400 mt-1.5 leading-relaxed">{tooltip.node.description}</div>}
              </div>
            )}
          </div>

          {/* ── selected panel wrapped in ParallaxTiltCard ── */}
          {selected && (
            <ParallaxTiltCard className="w-full">
              <div 
                className="p-5 rounded-2xl flex flex-col" 
                style={{ 
                  background: "linear-gradient(135deg, rgba(20,20,25,0.7) 0%, rgba(10,10,15,0.7) 100%)", 
                  border: `1px solid ${cfg(selected.type).color}50`, 
                  boxShadow: `inset 0 0 30px rgba(0,0,0,0.5), 0 0 30px ${cfg(selected.type).color}15`
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ background: cfg(selected.type).color, boxShadow: `0 0 10px ${cfg(selected.type).color}` }} />
                    <span className="font-bold text-white text-base tracking-wide font-mono">{selected.name}</span>
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono border"
                      style={{ 
                        color: cfg(selected.type).color, 
                        borderColor: cfg(selected.type).color + "40", 
                        background: cfg(selected.type).color + "10" 
                      }}
                    >
                      {selected.type}
                    </span>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">×</button>
                </div>
                {selected.description && <p className="text-sm text-gray-300 leading-relaxed font-mono">{selected.description}</p>}
                {selected.path && <p className="text-xs text-gray-500 font-mono mt-2 truncate bg-black/40 px-2 py-1 rounded border border-white/5">{selected.path}</p>}
                <div className="text-[10px] text-gray-600 mt-2 font-mono uppercase tracking-wider">Modified: {new Date(selected.mtime).toLocaleString()}</div>
              </div>
            </ParallaxTiltCard>
          )}

          {/* ── tech stack ── */}
          <div className="pb-6">
            <div className="section-label mb-4 text-[#D4A017]">Tactical Tech Stack</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {TECH_STACK.map(item => (
                <ParallaxTiltCard key={item.name} className="w-full">
                  <div 
                    className="p-3.5 flex items-center gap-3 h-full transition-all duration-300 bg-black/40 hover:bg-black/60 border border-white/5 hover:border-white/10"
                    style={{ minHeight: "68px" }}
                  >
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: item.color + "15", border: `1px solid ${item.color}30` }}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-100 truncate font-mono">{item.name}</div>
                      <div className="text-[10px] text-gray-500 truncate mt-0.5 font-mono">{item.sub}</div>
                    </div>
                  </div>
                </ParallaxTiltCard>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
