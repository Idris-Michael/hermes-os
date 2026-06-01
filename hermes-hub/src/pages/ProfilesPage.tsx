import { useState, useEffect, useMemo } from "react";
import { useProfiles } from "../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Cpu, 
  Clock, 
  Plug, 
  BookOpen, 
  CheckCircle, 
  AlertCircle, 
  Edit3, 
  Save, 
  X, 
  Wrench, 
  Server, 
  Link as LinkIcon 
} from "lucide-react";
import WebGLBackground from "../components/WebGLBackground";
import ParallaxTiltCard from "../components/ParallaxTiltCard";

interface Integration {
  name: string;
  status: "connected" | "pending" | "error";
  detail: string;
}

interface Tool {
  id: string;
  label: string;
  description: string;
}

interface MCP {
  id: string;
  label: string;
  description: string;
  status: "connected" | "pending" | "error";
}

interface Connector {
  id: string;
  label: string;
  detail: string;
  status: "connected" | "pending" | "error";
}

interface Cron {
  id: string;
  label: string;
  schedule: string;
  human: string;
  lastRun: string;
  status: "ok" | "error" | "pending";
}

interface Profile {
  id: string;
  name: string;
  suit: "spades" | "hearts" | "diamonds" | "clubs";
  rank: string;
  role: string;
  tagline: string;
  model: string;
  modelLabel: string;
  modelColor: string;
  routingModel?: string;
  routingModelLabel?: string;
  routingModelColor?: string;
  routingTasks?: string[];
  primaryTasks?: string[];
  badge: string;
  synced: boolean;
  accentColor: string;
  gateway: string;
  gatewayHandle: string;
  skills: string[];
  tools?: Tool[];
  mcps?: MCP[];
  connectors?: Connector[];
  integrations: Integration[];
  crons: Cron[];
  memory: string;
  stats: { sessionsTotal: number; messagesTotal: number; lastActive: string };
  soulContent: string | null;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const SUIT_LABELS: Record<string, string> = {
  spades: "Strategy",
  hearts: "Creative",
  diamonds: "Growth",
  clubs: "Systems",
};

const RANK_ORDER: Record<string, number> = {
  ace: 0, king: 1, queen: 2, jack: 3,
  "10": 4, "9": 5, "8": 6, "7": 7,
};

const SUIT_ORDER = ["spades", "hearts", "diamonds", "clubs"];

function StatusDot({ status }: { status: string }) {
  const c = status === "connected" ? "#2dd4bf" : status === "error" ? "#ef4444" : "#D4A017";
  return (
    <span 
      className="inline-block w-1.5 h-1.5 rounded-full mr-2 shrink-0 animate-pulse" 
      style={{ 
        background: c, 
        boxShadow: `0 0 6px ${c}` 
      }} 
    />
  );
}

function SoulEditor({ 
  content, 
  accentColor,
  onSave, 
  onCancel 
}: { 
  content: string; 
  accentColor: string;
  onSave: (v: string) => void; 
  onCancel: () => void 
}) {
  const [val, setVal] = useState(content);
  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        className="w-full min-h-[300px] bg-black/50 border border-white/10 rounded-xl text-gray-300 text-xs p-4 focus:outline-none focus:border-[#D4A017]/40 focus:shadow-[0_0_15px_rgba(212,160,23,0.05)] resize-y font-mono leading-relaxed"
      />
      <div className="flex gap-3 justify-end">
        <button 
          onClick={onCancel} 
          className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 background-transparent text-gray-400 text-xs font-bold font-mono tracking-wide flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <X size={12} /> Cancel
        </button>
        <button 
          onClick={() => onSave(val)} 
          className="px-4 py-2 rounded-xl text-black text-xs font-bold font-mono tracking-wide flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md"
          style={{ background: accentColor }}
        >
          <Save size={12} /> Save Agent Soul
        </button>
      </div>
    </div>
  );
}

function CardInset({ suit, rank, accentColor }: { suit: string; rank: string; accentColor: string }) {
  const sym = SUIT_SYMBOLS[suit] || "?";
  const rankLabel = rank === "ace" ? "A" : rank === "king" ? "K" : rank === "queen" ? "Q" : rank === "jack" ? "J" : rank.toUpperCase();
  return (
    <div 
      className="absolute top-3 right-3 w-8 h-11 rounded-lg flex flex-col items-center justify-center text-xs font-bold leading-none gap-0.5 select-none"
      style={{
        background: "rgba(0,0,0,0.6)",
        border: `1px solid ${accentColor}40`,
        color: accentColor,
        boxShadow: `0 0 8px ${accentColor}18`,
      }}
    >
      <span className="text-[10px] font-black">{rankLabel}</span>
      <span className="text-base select-none leading-none mt-0.5 font-serif">{sym}</span>
    </div>
  );
}

function ProfileCard({ 
  profile, 
  active, 
  onClick 
}: { 
  profile: Profile; 
  active: boolean; 
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden w-full text-left rounded-xl p-3.5 border transition-all cursor-pointer group active:scale-[0.98]`}
      style={{
        background: active ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
        borderColor: active ? `${profile.accentColor}50` : "rgba(255,255,255,0.06)",
        boxShadow: active ? `0 0 15px ${profile.accentColor}15, inset 0 0 10px ${profile.accentColor}0c` : "none",
      }}
    >
      {/* Background Watermark Suit */}
      <div 
        className="absolute -bottom-2 -left-2 text-6xl font-serif select-none pointer-events-none transition-all duration-300 group-hover:scale-110 opacity-[0.04]"
        style={{ color: profile.accentColor }}
      >
        {SUIT_SYMBOLS[profile.suit]}
      </div>

      <CardInset suit={profile.suit} rank={profile.rank} accentColor={profile.accentColor} />

      {active && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-[3px]" 
          style={{ background: profile.accentColor }} 
        />
      )}

      <div className="relative pr-10">
        <div 
          className="text-xs font-bold font-mono tracking-wide uppercase transition-colors"
          style={{ color: active ? profile.accentColor : "#9ca3af" }}
        >
          {profile.name}
        </div>
        <div className="text-[9px] text-gray-500 font-mono mt-1 leading-snug">{profile.role}</div>
        <div className="flex items-center gap-2 mt-3.5">
          <span 
            className="text-[8px] font-bold px-1.5 py-0.5 rounded border tracking-wide uppercase"
            style={{ 
              background: `${profile.modelColor}10`, 
              color: profile.modelColor,
              borderColor: `${profile.modelColor}25` 
            }}
          >
            {profile.modelLabel}
          </span>
          <span className="text-[8px] text-gray-600 font-mono">{profile.stats.lastActive}</span>
        </div>
      </div>
    </button>
  );
}

export default function ProfilesPage() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<string>(() => localStorage.getItem("hermes-active-profile") || "ace-of-spades");
  const [editingSoul, setEditingSoul] = useState(false);
  const [tab, setTab] = useState<"soul" | "skills" | "stack" | "integrations" | "crons">("soul");

  const { data: profilesData, isError: loadError } = useProfiles();
  const profiles = useMemo<Profile[]>(() => {
    if (!profilesData) return [];
    return [...(profilesData as unknown as Profile[])].sort((a, b) => {
      const si = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
      if (si !== 0) return si;
      return (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
    });
  }, [profilesData]);

  const profile = profiles.find(p => p.id === active) ?? profiles[0];

  const setActiveProfile = (id: string) => {
    setActive(id);
    localStorage.setItem("hermes-active-profile", id);
    setEditingSoul(false);
    setTab("soul");
  };

  const saveSoul = async (content: string) => {
    if (!profile) return;
    await fetch(`/api/profiles/${profile.id}/soul`, {
      method: "PUT",
      body: content,
      headers: { "Content-Type": "text/plain" }
    });
    // Update the shared cache so HermesAgentPage / FlowPage see the new soul too.
    queryClient.setQueryData<unknown[]>(["profiles"], (prev) =>
      Array.isArray(prev)
        ? prev.map((p) => ((p as { id: string }).id === profile.id ? { ...(p as object), soulContent: content } : p))
        : prev,
    );
    setEditingSoul(false);
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center p-12 font-mono text-xs h-full" style={{ color: "#f97316" }}>
        Failed to load profiles — ensure the hub server is running.
      </div>
    );
  }

  if (!profiles.length) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-mono text-xs h-full">
        <Clock className="animate-spin mr-2" size={14} /> Syncing neural agents deck...
      </div>
    );
  }

  const bySuit: Record<string, Profile[]> = {};
  for (const suit of SUIT_ORDER) {
    bySuit[suit] = profiles.filter(p => p.suit === suit);
  }

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white overflow-hidden">
      <WebGLBackground showModel={false} />

      {/* Decorative SVG connection grids */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.1 }}>
        <path d="M50 100 L 220 200 L 500 150 L 900 400" fill="none" stroke="#D4A017" strokeWidth="0.8" strokeDasharray="3,6" />
        <circle cx="220" cy="200" r="2" fill="#D4A017" />
        <circle cx="500" cy="150" r="2" fill="#D4A017" />
      </svg>

      <div className="relative z-10 flex-grow max-w-[1400px] mx-auto w-full px-4 pt-24 pb-8 flex flex-col md:flex-row gap-6 h-[calc(100vh-100px)]">
        
        {/* Left: Deck card selector */}
        <div className="w-full md:w-[260px] bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col h-full overflow-y-auto pr-2 shadow-xl select-none">
          <div className="text-[10px] font-bold tracking-widest font-mono text-[#D4A017] uppercase mb-4 pl-1 border-b border-white/5 pb-2">
            AGENT DECK CODES
          </div>

          {SUIT_ORDER.map(suit => {
            const cards = bySuit[suit];
            if (!cards?.length) return null;
            return (
              <div key={suit} className="mb-5 last:mb-0">
                <div 
                  className="flex items-center gap-2 mb-2 pl-1 border-l-2 py-0.5"
                  style={{ borderColor: profile?.suit === suit ? profile.accentColor : "rgba(255,255,255,0.1)" }}
                >
                  <span 
                    className="text-base select-none leading-none font-serif" 
                    style={{ color: profile?.suit === suit ? profile.accentColor : "#4b5563" }}
                  >
                    {SUIT_SYMBOLS[suit]}
                  </span>
                  <span className="text-[9px] font-bold font-mono tracking-widest text-gray-500 uppercase">
                    {SUIT_LABELS[suit]}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {cards.map(p => (
                    <ProfileCard 
                      key={p.id} 
                      profile={p} 
                      active={active === p.id} 
                      onClick={() => setActiveProfile(p.id)} 
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Detailed Dashboard view */}
        {profile && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto pr-2 pb-6">
            
            {/* Header Title Card wrapped in ParallaxTiltCard */}
            <ParallaxTiltCard className="w-full mb-6">
              <div 
                className="p-6 flex flex-col bg-black/50 border border-white/10 rounded-2xl relative shadow-2xl relative overflow-hidden"
                style={{ 
                  borderColor: `${profile.accentColor}35`, 
                  boxShadow: `0 0 30px ${profile.accentColor}08` 
                }}
              >
                {/* Large watermark suit */}
                <div 
                  className="absolute right-4 top-2 text-[140px] font-serif select-none pointer-events-none opacity-[0.03] leading-none"
                  style={{ color: profile.accentColor }}
                >
                  {SUIT_SYMBOLS[profile.suit]}
                </div>

                {/* Tactical Playing Card corners marker */}
                <div className="absolute top-4 right-5 text-center font-mono select-none">
                  <div className="text-xl font-black leading-none" style={{ color: profile.accentColor }}>
                    {profile.rank === "ace" ? "A" : profile.rank === "king" ? "K" : profile.rank === "queen" ? "Q" : profile.rank === "jack" ? "J" : profile.rank.toUpperCase()}
                  </div>
                  <div className="text-2xl mt-0.5 leading-none font-serif" style={{ color: profile.accentColor }}>
                    {SUIT_SYMBOLS[profile.suit]}
                  </div>
                </div>

                <div className="relative pr-16 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base select-none leading-none font-serif" style={{ color: profile.accentColor }}>
                      {SUIT_SYMBOLS[profile.suit]}
                    </span>
                    <span className="text-[10px] font-bold font-mono tracking-widest text-gray-400 uppercase">
                      {SUIT_LABELS[profile.suit]} SUIT PERSONA
                    </span>
                  </div>

                  <div>
                    <h2 className="text-2xl font-black font-mono tracking-wider" style={{ color: profile.accentColor }}>
                      {profile.name}
                    </h2>
                    <p className="text-xs text-gray-300 mt-1 font-mono leading-relaxed max-w-xl">{profile.tagline}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center mt-2">
                    <span 
                      className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded border uppercase"
                      style={{ 
                        background: `${profile.modelColor}15`, 
                        color: profile.modelColor, 
                        borderColor: `${profile.modelColor}35` 
                      }}
                    >
                      {profile.modelLabel}
                    </span>
                    <span 
                      className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded border uppercase"
                      style={{ 
                        background: profile.synced ? "rgba(45,212,191,0.08)" : "rgba(212,160,23,0.08)", 
                        color: profile.synced ? "#2dd4bf" : "#D4A017", 
                        borderColor: profile.synced ? "rgba(45,212,191,0.25)" : "rgba(212,160,23,0.25)" 
                      }}
                    >
                      {profile.badge}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">/ {profile.role}</span>
                    <span className="text-gray-600 font-mono">·</span>
                    <span className="text-[10px] text-gray-500 font-mono">{profile.gatewayHandle}</span>
                  </div>
                </div>
              </div>
            </ParallaxTiltCard>

            {/* Stats numeric panel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total Sessions", value: profile.stats.sessionsTotal },
                { label: "Messages Exchanged", value: profile.stats.messagesTotal },
                { label: "Last Neural Active", value: profile.stats.lastActive },
              ].map(({ label, value }) => (
                <div 
                  key={label} 
                  className="bg-black/30 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all relative overflow-hidden group shadow-lg"
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-[2px] transition-all group-hover:w-[4px]" 
                    style={{ background: profile.accentColor }} 
                  />
                  <div className="text-xl font-black font-mono tracking-wider" style={{ color: profile.accentColor }}>{value}</div>
                  <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mt-1">{label}</div>
                </div>
              ))}
            </div>

            {/* Model Routing — only shown when routingModel is set */}
            {profile.routingModel && (
              <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-4">
                <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-3">Model Routing</div>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                  <div className="flex-1">
                    <span
                      className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded border uppercase mb-2 inline-block"
                      style={{ background: `${profile.modelColor}15`, color: profile.modelColor, borderColor: `${profile.modelColor}35` }}
                    >
                      {profile.modelLabel} — PRIMARY
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(profile.primaryTasks ?? []).map(t => (
                        <span key={t} className="text-[9px] text-gray-400 font-mono bg-white/5 border border-white/8 rounded px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span
                      className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded border uppercase mb-2 inline-block"
                      style={{ background: `${profile.routingModelColor}15`, color: profile.routingModelColor, borderColor: `${profile.routingModelColor}35` }}
                    >
                      {profile.routingModelLabel} — ROUTING
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(profile.routingTasks ?? []).map(t => (
                        <span key={t} className="text-[9px] text-gray-400 font-mono bg-white/5 border border-white/8 rounded px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tabs interface container */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col flex-1">
              
              {/* Tab Pills */}
              <div className="flex border-b border-white/5 overflow-x-auto gap-2 mb-6 scrollbar-none">
                {(["soul", "skills", "stack", "integrations", "crons"] as const).map(t => {
                  const activeTab = tab === t;
                  return (
                    <button 
                      key={t} 
                      onClick={() => setTab(t)} 
                      className="px-4 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wide flex items-center gap-2 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                      style={{
                        background: activeTab ? `${profile.accentColor}12` : "transparent",
                        borderBottom: `2px solid ${activeTab ? profile.accentColor : "transparent"}`,
                        color: activeTab ? profile.accentColor : "#52525b",
                      }}
                    >
                      {t === "soul" && <BookOpen size={12} />}
                      {t === "skills" && <Cpu size={12} />}
                      {t === "stack" && <Server size={12} />}
                      {t === "integrations" && <Plug size={12} />}
                      {t === "crons" && <Clock size={12} />}
                      <span className="uppercase tracking-wider text-[10px]">{t}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Panels */}
              <div className="flex-1">
                
                {/* Soul Tab */}
                {tab === "soul" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div className="text-[10px] font-bold font-mono tracking-widest text-gray-400 uppercase">
                        SOUL SPECIFICATION FILE
                      </div>
                      {!editingSoul && (
                        <button 
                          onClick={() => setEditingSoul(true)} 
                          className="px-3 py-1 rounded-lg border text-[10px] font-bold font-mono tracking-wide flex items-center gap-1.5 cursor-pointer hover:bg-white/5 transition-all"
                          style={{ color: profile.accentColor, borderColor: `${profile.accentColor}40` }}
                        >
                          <Edit3 size={11} /> Edit Persona
                        </button>
                      )}
                    </div>
                    
                    {editingSoul ? (
                      <SoulEditor 
                        content={profile.soulContent ?? ""} 
                        accentColor={profile.accentColor}
                        onSave={saveSoul} 
                        onCancel={() => setEditingSoul(false)} 
                      />
                    ) : (
                      <pre className="m-0 text-xs text-gray-300 leading-relaxed font-mono bg-black/60 border border-white/5 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap max-h-[420px]">
                        {profile.soulContent ?? "No soul specification configured."}
                      </pre>
                    )}
                  </div>
                )}

                {/* Skills Tab */}
                {tab === "skills" && (
                  <div>
                    <div className="text-[10px] font-bold font-mono tracking-widest text-gray-400 uppercase mb-4">
                      ASSIGNED CAPABILITY SKILLS ({profile.skills.length})
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {profile.skills.map(s => (
                        <span 
                          key={s} 
                          className="text-[10px] font-bold font-mono px-3 py-1.5 rounded-xl border tracking-wide"
                          style={{ 
                            background: `${profile.accentColor}08`, 
                            color: profile.accentColor, 
                            borderColor: `${profile.accentColor}25` 
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stack Tab */}
                {tab === "stack" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Tools */}
                    {(profile.tools?.length ?? 0) > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                          <Wrench size={12} style={{ color: profile.accentColor }} />
                          <span className="text-[10px] font-bold font-mono tracking-widest text-gray-400 uppercase">
                            PERSONA TOOLS ({profile.tools!.length})
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {profile.tools!.map(tool => (
                            <div 
                              key={tool.id} 
                              className="p-3 bg-black/40 border rounded-xl"
                              style={{ borderColor: `${profile.accentColor}18` }}
                            >
                              <div className="text-xs font-bold font-mono tracking-wide" style={{ color: profile.accentColor }}>{tool.label}</div>
                              <div className="text-[10px] text-gray-500 font-mono mt-1 leading-normal">{tool.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* MCPs & Connectors */}
                    <div className="flex flex-col gap-6">
                      {/* MCPs */}
                      {(profile.mcps?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                            <Server size={12} className="text-indigo-400" />
                            <span className="text-[10px] font-bold font-mono tracking-widest text-gray-400 uppercase">
                              MCP CAPABILITY SERVERS ({profile.mcps!.length})
                            </span>
                          </div>
                          <div className="flex flex-col gap-2">
                            {profile.mcps!.map(mcp => (
                              <div 
                                key={mcp.id} 
                                className="flex items-start justify-between p-3 bg-black/40 border border-indigo-500/10 rounded-xl"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <StatusDot status={mcp.status} />
                                    <span className="text-xs font-bold font-mono tracking-wide text-indigo-400">{mcp.label}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-1 pl-3.5 leading-normal">{mcp.description}</div>
                                </div>
                                {mcp.status === "connected"
                                  ? <CheckCircle size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                                  : <AlertCircle size={12} className="text-[#D4A017] shrink-0 mt-0.5" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Connectors */}
                      {(profile.connectors?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                            <LinkIcon size={12} className="text-teal-400" />
                            <span className="text-[10px] font-bold font-mono tracking-widest text-gray-400 uppercase">
                              DATA CONNECTORS ({profile.connectors!.length})
                            </span>
                          </div>
                          <div className="flex flex-col gap-2">
                            {profile.connectors!.map(conn => (
                              <div 
                                key={conn.id} 
                                className="flex items-center justify-between p-3 bg-black/40 border border-teal-500/10 rounded-xl"
                              >
                                <div className="flex items-center">
                                  <StatusDot status={conn.status} />
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <span className="text-xs font-bold font-mono tracking-wide text-gray-200">{conn.label}</span>
                                    <span className="text-[9px] text-gray-500 font-mono">{conn.detail}</span>
                                  </div>
                                </div>
                                {conn.status === "connected"
                                  ? <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                                  : <AlertCircle size={12} className="text-[#D4A017] shrink-0" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {!(profile.tools?.length) && !(profile.mcps?.length) && !(profile.connectors?.length) && (
                      <div className="col-span-full py-8 text-center text-xs text-gray-500 font-mono italic">
                        No capability tools or MCP stack configured for this agent.
                      </div>
                    )}
                  </div>
                )}

                {/* Integrations Tab */}
                {tab === "integrations" && (
                  <div>
                    <div className="text-[10px] font-bold font-mono tracking-widest text-gray-400 uppercase mb-4">
                      EXTERNAL PLATFORM INTEGRATIONS
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {profile.integrations.map((intg, i) => (
                        <div 
                          key={i} 
                          className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl hover:bg-black/50 transition-colors"
                        >
                          <div className="flex items-center">
                            <StatusDot status={intg.status} />
                            <div>
                              <div className="text-xs font-bold font-mono tracking-wide text-gray-200">{intg.name}</div>
                              <div className="text-[9px] text-gray-500 font-mono mt-0.5">{intg.detail}</div>
                            </div>
                          </div>
                          {intg.status === "connected"
                            ? <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                            : <AlertCircle size={12} className="text-[#D4A017] shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Crons Tab */}
                {tab === "crons" && (
                  <div>
                    <div className="text-[10px] font-bold font-mono tracking-widest text-gray-400 uppercase mb-4">
                      ACTIVATED CRON AUTOMATIONS ({profile.crons.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile.crons.map(cron => (
                        <div 
                          key={cron.id} 
                          className="p-4 bg-black/40 border border-white/5 rounded-xl flex flex-col h-full hover:bg-black/50 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-3 mb-2">
                            <span className="text-xs font-bold font-mono text-white tracking-wide">{cron.label}</span>
                            <span 
                              className="text-[8px] font-bold tracking-wider px-2 py-0.5 rounded border uppercase"
                              style={{
                                color: cron.status === "ok" ? "#2dd4bf" : "#ef4444",
                                borderColor: cron.status === "ok" ? "rgba(45,212,191,0.25)" : "rgba(239,68,68,0.25)",
                                background: cron.status === "ok" ? "rgba(45,212,191,0.08)" : "rgba(239,68,68,0.08)",
                              }}
                            >
                              {cron.status}
                            </span>
                          </div>
                          
                          <div className="text-xs text-gray-400 font-mono mt-1 leading-normal flex-1">{cron.human}</div>
                          
                          <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-1 text-[9px] font-mono text-gray-500">
                            <div>Schedule: <span className="text-gray-400">{cron.schedule}</span></div>
                            <div>Last Execution: <span className="text-gray-400">{cron.lastRun ? new Date(cron.lastRun).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
