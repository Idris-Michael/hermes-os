import { useState, useEffect, useRef, useCallback } from "react";
import { useProfiles } from "../hooks/queries";
import AgentTriadNav from "../components/AgentTriadNav";

interface Profile {
  id: string;
  name: string;
  suit: string;
  rank: string;
  role: string;
  tagline: string;
  model: string;
  modelLabel: string;
  modelColor: string;
  accentColor: string;
  badge: string;
  synced: boolean;
  gatewayHandle: string;
  skills: string[];
  tools?: { id: string; label: string; description: string }[];
  mcps?: { id: string; label: string; description: string; status: string }[];
  connectors?: { id: string; label: string; detail: string; status: string }[];
  stats: { sessionsTotal: number; messagesTotal: number; lastActive: string };
}

interface Node {
  id: string;
  x: number;
  y: number;
  profile: Profile;
}

interface Edge {
  from: string;
  to: string;
  label: string;
  color: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};

const NODE_W = 148;
const NODE_H = 72;

// Initial layout — 4 suits in columns, 2-3 rows each
const INITIAL_POSITIONS: Record<string, { x: number; y: number }> = {
  "ace-of-spades":   { x: 60,  y: 80  },
  "king-of-spades":  { x: 60,  y: 200 },
  "queen-of-spades": { x: 60,  y: 320 },
  "ace-of-hearts":   { x: 270, y: 80  },
  "king-of-hearts":  { x: 270, y: 200 },
  "queen-of-hearts": { x: 270, y: 320 },
  "ace-of-diamonds": { x: 480, y: 80  },
  "king-of-diamonds":{ x: 480, y: 200 },
  "ace-of-clubs":    { x: 690, y: 80  },
  "king-of-clubs":   { x: 690, y: 200 },
};

// Edges: directed relationships between personas
const EDGE_DEFS: { from: string; to: string; label: string; color: string }[] = [
  // Strategy → execution chain
  { from: "ace-of-spades",   to: "king-of-spades",   label: "Google brief",   color: "#8b5cf6" },
  { from: "ace-of-spades",   to: "queen-of-spades",  label: "Meta brief",     color: "#8b5cf6" },
  { from: "ace-of-spades",   to: "king-of-hearts",   label: "Copy brief",     color: "#8b5cf6" },
  { from: "ace-of-spades",   to: "ace-of-diamonds",  label: "Council",        color: "#D4A017" },
  // Creative chain
  { from: "ace-of-hearts",   to: "king-of-hearts",   label: "Creative brief", color: "#ec4899" },
  { from: "ace-of-hearts",   to: "queen-of-hearts",  label: "UGC brief",      color: "#ec4899" },
  // Tracking feeds auditors
  { from: "king-of-clubs",   to: "king-of-spades",   label: "Tracking sign-off", color: "#2dd4bf" },
  { from: "king-of-clubs",   to: "queen-of-spades",  label: "CAPI verified",  color: "#2dd4bf" },
  // Shopping needs tracking
  { from: "king-of-clubs",   to: "king-of-diamonds", label: "Feed tracking",  color: "#2dd4bf" },
  // Automation orchestrates all
  { from: "ace-of-clubs",    to: "king-of-clubs",    label: "Deploy GTM",     color: "#2dd4bf" },
  { from: "ace-of-clubs",    to: "ace-of-spades",    label: "Pipeline status", color: "#6b7280" },
  // Biz dev feeds strategy
  { from: "ace-of-diamonds", to: "ace-of-spades",    label: "Client onboard", color: "#f59e0b" },
];

function midpoint(ax: number, ay: number, bx: number, by: number) {
  return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

function StatusDot({ status }: { status: string }) {
  const c = status === "connected" ? "#2dd4bf" : status === "error" ? "#ef4444" : "#D4A017";
  return (
    <span style={{
      display: "inline-block", width: 6, height: 6, borderRadius: "50%",
      background: c, marginRight: 5, flexShrink: 0,
    }} />
  );
}

export default function FlowPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"tools" | "mcps" | "connectors">("tools");
  const dragging = useRef<{ id: string; ox: number; oy: number; mx: number; my: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number }>({
    active: false, sx: 0, sy: 0, px: 0, py: 0,
  });

  const { data: profilesData } = useProfiles();
  const didSeedRef = useRef(false);
  useEffect(() => {
    if (didSeedRef.current) return;
    if (!profilesData || (profilesData as unknown as Profile[]).length === 0) return;
    didSeedRef.current = true;
    const data = profilesData as unknown as Profile[];
    setProfiles(data);
    setNodes(data.map(p => ({
      id: p.id,
      profile: p,
      x: INITIAL_POSITIONS[p.id]?.x ?? 400,
      y: INITIAL_POSITIONS[p.id]?.y ?? 300,
    })));
  }, [profilesData]);

  const getNode = useCallback((id: string) => nodes.find(n => n.id === id), [nodes]);
  const selectedProfile = profiles.find(p => p.id === selected);

  // ── Drag nodes ──
  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    dragging.current = { id, ox: node.x, oy: node.y, mx: e.clientX, my: e.clientY };
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (dragging.current) return;
    panRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (dragging.current) {
      const dx = e.clientX - dragging.current.mx;
      const dy = e.clientY - dragging.current.my;
      setNodes(ns => ns.map(n =>
        n.id === dragging.current!.id
          ? { ...n, x: dragging.current!.ox + dx, y: dragging.current!.oy + dy }
          : n
      ));
    } else if (panRef.current.active) {
      const dx = e.clientX - panRef.current.sx;
      const dy = e.clientY - panRef.current.sy;
      setPan({ x: panRef.current.px + dx, y: panRef.current.py + dy });
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    panRef.current.active = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const selectedNode = selected ? getNode(selected) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#070d07" }}>
      <div style={{ padding: "16px 16px 0 16px" }}><AgentTriadNav /></div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* Canvas */}
      <div
        ref={canvasRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: "grab" }}
        onMouseDown={onCanvasMouseDown}
      >
        {/* Grid background */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x % 40},${pan.y % 40})`}>
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Edges */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          <defs>
            {EDGE_DEFS.map((e, i) => (
              <marker key={i} id={`arrow-${i}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={e.color} opacity="0.7" />
              </marker>
            ))}
          </defs>
          {EDGE_DEFS.map((edge, i) => {
            const a = getNode(edge.from);
            const b = getNode(edge.to);
            if (!a || !b) return null;
            const ax = a.x + pan.x + NODE_W / 2;
            const ay = a.y + pan.y + NODE_H / 2;
            const bx = b.x + pan.x + NODE_W / 2;
            const by = b.y + pan.y + NODE_H / 2;
            const isActive = selected === edge.from || selected === edge.to;
            const mid = midpoint(ax, ay, bx, by);
            // Bezier curve
            const cx = (ax + bx) / 2;
            const cy = Math.min(ay, by) - 30;
            return (
              <g key={i}>
                <path
                  d={`M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={isActive ? 2 : 1}
                  opacity={isActive ? 0.9 : selected ? 0.15 : 0.45}
                  strokeDasharray={isActive ? "none" : "4 3"}
                  markerEnd={`url(#arrow-${i})`}
                />
                {isActive && (
                  <text
                    x={mid.x}
                    y={mid.y - 6}
                    textAnchor="middle"
                    fontSize={9}
                    fill={edge.color}
                    opacity={0.9}
                    style={{ fontFamily: "Space Grotesk, monospace", letterSpacing: "0.04em" }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const p = node.profile;
          const isSelected = selected === node.id;
          const isConnected = selected
            ? EDGE_DEFS.some(e => (e.from === selected && e.to === node.id) || (e.to === selected && e.from === node.id))
            : false;
          const dimmed = selected && !isSelected && !isConnected;

          return (
            <div
              key={node.id}
              onMouseDown={e => onNodeMouseDown(e, node.id)}
              onClick={() => {
                setSelected(prev => prev === node.id ? null : node.id);
                setDetailTab("tools");
              }}
              style={{
                position: "absolute",
                left: node.x + pan.x,
                top: node.y + pan.y,
                width: NODE_W,
                height: NODE_H,
                borderRadius: 10,
                background: isSelected
                  ? `linear-gradient(135deg, ${p.accentColor}22, rgba(255,255,255,0.03))`
                  : "rgba(255,255,255,0.025)",
                border: `1px solid ${isSelected ? p.accentColor + "99" : isConnected ? p.accentColor + "44" : "rgba(255,255,255,0.07)"}`,
                boxShadow: isSelected ? `0 0 24px ${p.accentColor}30` : "none",
                cursor: "pointer",
                userSelect: "none",
                transition: "opacity 0.15s, box-shadow 0.15s",
                opacity: dimmed ? 0.2 : 1,
                overflow: "hidden",
                padding: "10px 12px",
                boxSizing: "border-box",
              }}
            >
              {/* Suit watermark */}
              <div style={{
                position: "absolute", right: 6, bottom: -4,
                fontSize: 44, color: p.accentColor, opacity: 0.07,
                fontFamily: "serif", lineHeight: 1, pointerEvents: "none",
              }}>
                {SUIT_SYMBOLS[p.suit]}
              </div>

              {/* Active border stripe */}
              {isSelected && (
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                  borderRadius: "10px 0 0 10px", background: p.accentColor,
                }} />
              )}

              <div style={{ position: "relative" }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.07em",
                  color: p.accentColor, marginBottom: 1, lineHeight: 1.2,
                }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 6, lineHeight: 1.3 }}>
                  {p.role}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{
                    fontSize: 7.5, fontWeight: 700, padding: "1.5px 5px", borderRadius: 3,
                    background: p.modelColor + "20", color: p.modelColor,
                    border: `1px solid ${p.modelColor}35`,
                  }}>
                    {p.modelLabel}
                  </span>
                  <span style={{ fontSize: 8, color: "#374151" }}>{p.stats.lastActive}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div style={{
          position: "absolute", bottom: 16, left: 16,
          background: "rgba(7,13,7,0.85)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8,
          padding: "10px 14px", fontSize: 9, color: "#6b7280",
        }}>
          <div style={{ fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, color: "#4b5563" }}>LEGEND</div>
          {[
            { color: "#8b5cf6", label: "Strategy → Execution" },
            { color: "#ec4899", label: "Creative Direction" },
            { color: "#2dd4bf", label: "Tracking & Measurement" },
            { color: "#f59e0b", label: "Business Development" },
            { color: "#D4A017", label: "Council / Orchestration" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <div style={{ width: 20, height: 1.5, background: color, opacity: 0.7, borderRadius: 2 }} />
              <span>{label}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 6, color: "#374151" }}>
            Drag nodes · Click to inspect · Drag canvas to pan
          </div>
        </div>

        {/* Suit section labels */}
        {[
          { label: "♠ STRATEGY", x: 60,  y: 44,  color: "#8b5cf6" },
          { label: "♥ CREATIVE", x: 270, y: 44,  color: "#ec4899" },
          { label: "♦ GROWTH",   x: 480, y: 44,  color: "#f59e0b" },
          { label: "♣ SYSTEMS",  x: 690, y: 44,  color: "#2dd4bf" },
        ].map(({ label, x, y, color }) => (
          <div key={label} style={{
            position: "absolute",
            left: x + pan.x,
            top: y + pan.y,
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            color, opacity: 0.5,
            pointerEvents: "none", userSelect: "none",
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {selectedProfile && (
        <div style={{
          width: 300, borderLeft: "1px solid rgba(255,255,255,0.06)",
          background: "#0a100a", overflowY: "auto", flexShrink: 0,
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 18px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: `linear-gradient(135deg, ${selectedProfile.accentColor}10, transparent)`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 9, color: selectedProfile.accentColor + "aa", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 2 }}>
                  {SUIT_SYMBOLS[selectedProfile.suit]} {selectedProfile.suit.toUpperCase()}
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.07em", color: selectedProfile.accentColor }}>
                  {selectedProfile.name}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{selectedProfile.role}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: "transparent", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 8, lineHeight: 1.5 }}>
              {selectedProfile.tagline}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                background: selectedProfile.modelColor + "20", color: selectedProfile.modelColor,
                border: `1px solid ${selectedProfile.modelColor}35`,
              }}>
                {selectedProfile.modelLabel}
              </span>
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 3,
                background: selectedProfile.synced ? "rgba(45,212,191,0.1)" : "rgba(212,160,23,0.1)",
                color: selectedProfile.synced ? "#2dd4bf" : "#D4A017",
                border: `1px solid ${selectedProfile.synced ? "rgba(45,212,191,0.25)" : "rgba(212,160,23,0.25)"}`,
              }}>
                {selectedProfile.badge}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {[
              { label: "Sessions", v: selectedProfile.stats.sessionsTotal },
              { label: "Messages", v: selectedProfile.stats.messagesTotal },
              { label: "Active", v: selectedProfile.stats.lastActive },
            ].map(({ label, v }) => (
              <div key={label} style={{ padding: "10px 14px", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: selectedProfile.accentColor }}>{v}</div>
                <div style={{ fontSize: 8, color: "#374151", marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Connected edges */}
          {(() => {
            const outbound = EDGE_DEFS.filter(e => e.from === selected);
            const inbound  = EDGE_DEFS.filter(e => e.to   === selected);
            if (!outbound.length && !inbound.length) return null;
            return (
              <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "#374151", marginBottom: 8 }}>CONNECTIONS</div>
                {inbound.map((e, i) => (
                  <div key={`in-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "#6b7280" }}>
                      ← <span style={{ color: e.color }}>{e.from.replace(/-/g, " ").toUpperCase()}</span>
                      <span style={{ color: "#374151" }}> · {e.label}</span>
                    </span>
                  </div>
                ))}
                {outbound.map((e, i) => (
                  <div key={`out-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "#6b7280" }}>
                      → <span style={{ color: e.color }}>{e.to.replace(/-/g, " ").toUpperCase()}</span>
                      <span style={{ color: "#374151" }}> · {e.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Stack tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {(["tools", "mcps", "connectors"] as const).map(t => (
              <button key={t} onClick={() => setDetailTab(t)} style={{
                flex: 1, padding: "8px 4px", fontSize: 9, fontWeight: detailTab === t ? 700 : 400,
                color: detailTab === t ? selectedProfile.accentColor : "#374151",
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: `2px solid ${detailTab === t ? selectedProfile.accentColor : "transparent"}`,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ padding: "12px 18px" }}>
            {detailTab === "tools" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(selectedProfile.tools ?? []).length === 0 && (
                  <div style={{ fontSize: 10, color: "#374151" }}>No tools defined.</div>
                )}
                {(selectedProfile.tools ?? []).map(tool => (
                  <div key={tool.id} style={{
                    padding: "8px 10px", borderRadius: 6,
                    background: `${selectedProfile.accentColor}10`,
                    border: `1px solid ${selectedProfile.accentColor}20`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: selectedProfile.accentColor, marginBottom: 2 }}>{tool.label}</div>
                    <div style={{ fontSize: 9, color: "#6b7280" }}>{tool.description}</div>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "mcps" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(selectedProfile.mcps ?? []).length === 0 && (
                  <div style={{ fontSize: 10, color: "#374151" }}>No MCP servers defined.</div>
                )}
                {(selectedProfile.mcps ?? []).map(mcp => (
                  <div key={mcp.id} style={{
                    padding: "8px 10px", borderRadius: 6,
                    background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <StatusDot status={mcp.status} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#818cf8" }}>{mcp.label}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#6b7280", paddingLeft: 11 }}>{mcp.description}</div>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "connectors" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(selectedProfile.connectors ?? []).length === 0 && (
                  <div style={{ fontSize: 10, color: "#374151" }}>No connectors defined.</div>
                )}
                {(selectedProfile.connectors ?? []).map(conn => (
                  <div key={conn.id} style={{
                    padding: "8px 10px", borderRadius: 6,
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(45,212,191,0.12)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <StatusDot status={conn.status} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#e5e7eb" }}>{conn.label}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#6b7280", paddingLeft: 11 }}>{conn.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skills */}
          <div style={{ padding: "0 18px 16px" }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "#374151", marginBottom: 7 }}>
              SKILLS ({selectedProfile.skills.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {selectedProfile.skills.map(s => (
                <span key={s} style={{
                  fontSize: 8, padding: "3px 7px", borderRadius: 4,
                  background: selectedProfile.accentColor + "12",
                  color: selectedProfile.accentColor,
                  border: `1px solid ${selectedProfile.accentColor}25`,
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
