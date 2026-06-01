import { useState, useEffect, useCallback } from "react";
import { 
  Instagram, 
  Inbox, 
  Calendar, 
  TrendingUp, 
  Brain, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight, 
  Sparkles, 
  AlertCircle, 
  FileText, 
  Save 
} from "lucide-react";
import WebGLBackground from "../components/WebGLBackground";
import ParallaxTiltCard from "../components/ParallaxTiltCard";

type ApprovalState = "pending" | "queued" | "approved" | "rejected" | "expired" | "publishing" | "published";

interface Variant {
  id: string;
  slot_id: string;
  hook_text: string;
  hook_style: "transformation" | "contrarian" | "curiosity-gap";
  caption: string;
  hashtags: string;
  render_path: string | null;
  thumbnail_path: string | null;
}

interface QueueSlot {
  id: string;
  account: "mikeb" | "severus";
  post_at: string;
  pillar: string;
  hook_style: string | null;
  approval_state: ApprovalState;
  selected_variant_id: string | null;
  variants: Variant[];
}

interface CalendarSlot {
  id: string;
  account: "mikeb" | "severus";
  post_at: string;
  pillar: string;
  approval_state: ApprovalState;
}

interface MetricRow {
  id: string;
  account: "mikeb" | "severus";
  post_at: string;
  pillar: string;
  hook_style: string | null;
  watch_time_s: number | null;
  sends: number | null;
  saves: number | null;
  reach: number | null;
  score: number | null;
}

const ACCOUNT_COLOR: Record<string, string> = {
  mikeb: "#00FF88",
  severus: "#7C3AED",
};

const ACCOUNT_LABEL: Record<string, string> = {
  mikeb: "@mikeb.io",
  severus: "@severus_connects",
};

const PILLAR_COLOR: Record<string, string> = {
  "ai-tool-demo": "#00FF88",
  "build-in-public": "#06b6d4",
  "technical-breakdown": "#f59e0b",
  "i-built-x": "#ec4899",
  "case-study": "#7C3AED",
  "ga4-tip": "#3b82f6",
  "ads-tip": "#10b981",
  "process-breakdown": "#f97316",
  "client-result": "#a855f7",
};

const HOOK_STYLE_LABEL: Record<string, string> = {
  transformation: "Transform",
  contrarian: "Contrarian",
  "curiosity-gap": "Curiosity",
};

function StateTag({ state }: { state: ApprovalState }) {
  const colors: Record<ApprovalState, string> = {
    pending: "#9ca3af",
    queued: "#f59e0b",
    approved: "#10b981",
    rejected: "#ef4444",
    expired: "#6b7280",
    publishing: "#3b82f6",
    published: "#00FF88",
  };
  return (
    <span
      className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded border uppercase"
      style={{
        color: colors[state],
        borderColor: `${colors[state]}40`,
        background: `${colors[state]}10`,
      }}
    >
      {state}
    </span>
  );
}

function QueuePanel() {
  const [slots, setSlots] = useState<QueueSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [editCaption, setEditCaption] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ig/queue");
      const d = await r.json();
      if (d.success && Array.isArray(d.data)) {
        setSlots(d.data);
        const sel: Record<string, string> = {};
        d.data.forEach((s: QueueSlot) => {
          if (s.variants?.length > 0) sel[s.id] = s.variants[0].id;
        });
        setSelected(sel);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(slotId: string) {
    const variantId = selected[slotId];
    if (!variantId) return;
    setBusy(b => ({ ...b, [slotId]: true }));
    try {
      const cap = editCaption[variantId];
      if (cap) {
        await fetch(`/api/ig/slot/${slotId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: cap, variant_id: variantId }),
        });
      }
      await fetch("/api/ig/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId, variant_id: variantId }),
      });
      await load();
    } catch {
      // ignore
    } finally {
      setBusy(b => ({ ...b, [slotId]: false }));
    }
  }

  async function reject(slotId: string) {
    setBusy(b => ({ ...b, [slotId]: true }));
    try {
      await fetch("/api/ig/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId, reason: "manual reject" }),
      });
      await load();
    } catch {
      // ignore
    } finally {
      setBusy(b => ({ ...b, [slotId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-mono text-xs">
        <Clock className="animate-spin mr-2" size={14} /> Loading autonomous UGC queue...
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="max-w-md mx-auto py-8">
        <ParallaxTiltCard className="w-full">
          <div className="p-8 flex flex-col items-center text-center bg-black/40 border border-white/10 rounded-2xl relative">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#D4A017]/10 border border-[#D4A017]/25 text-[#D4A017] mb-4 shadow-[0_0_15px_rgba(212,160,23,0.1)]">
              <Inbox size={20} />
            </div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-2">Queue Exhausted</h3>
            <p className="text-xs text-gray-400 font-mono leading-relaxed mb-6">
              All scheduled posts have been approved or expired. Wait for the scheduled UGC generation script to runs or feed manual seed data.
            </p>
            <button
              onClick={async () => {
                await fetch("/api/ig/seed-test", { method: "POST" });
                await load();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide text-black bg-[#D4A017] hover:bg-[#D4A017]/90 active:scale-95 transition-all shadow-[0_0_15px_rgba(212,160,23,0.3)] cursor-pointer"
            >
              <Sparkles size={12} /> Seed Tactical Test Data
            </button>
          </div>
        </ParallaxTiltCard>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {slots.map(slot => {
        const selVariant = slot.variants.find(v => v.id === selected[slot.id]) ?? slot.variants[0];
        const postDate = new Date(slot.post_at);
        return (
          <ParallaxTiltCard key={slot.id} className="w-full">
            <div className="p-5 flex flex-col bg-black/50 hover:bg-black/60 border border-white/10 rounded-2xl shadow-xl transition-all h-full">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full animate-pulse" 
                    style={{ 
                      background: ACCOUNT_COLOR[slot.account],
                      boxShadow: `0 0 8px ${ACCOUNT_COLOR[slot.account]}`
                    }} 
                  />
                  <span className="text-[10px] font-bold font-mono tracking-wider" style={{ color: ACCOUNT_COLOR[slot.account] }}>
                    {ACCOUNT_LABEL[slot.account]}
                  </span>
                  <span className="text-gray-600 text-[10px] font-mono">·</span>
                  <span className="text-gray-400 text-[10px] font-mono">
                    {postDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{" "}
                    {postDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <StateTag state={slot.approval_state} />
              </div>

              {/* Pillar tag */}
              <div className="mb-4">
                <span
                  className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded border uppercase"
                  style={{
                    color: PILLAR_COLOR[slot.pillar] ?? "#9ca3af",
                    borderColor: `${PILLAR_COLOR[slot.pillar] ?? "#9ca3af"}30`,
                    background: `${PILLAR_COLOR[slot.pillar] ?? "#9ca3af"}0d`,
                  }}
                >
                  {slot.pillar.replace(/-/g, " ")}
                </span>
              </div>

              {/* Variant selector */}
              {slot.variants.length > 0 && (
                <div className="flex gap-2 mb-4 bg-white/5 border border-white/5 rounded-xl p-1">
                  {slot.variants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelected(s => ({ ...s, [slot.id]: v.id }))}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wide transition-all cursor-pointer"
                      style={{
                        background: selected[slot.id] === v.id ? "rgba(212,160,23,0.15)" : "transparent",
                        border: selected[slot.id] === v.id ? "1px solid #D4A01760" : "1px solid transparent",
                        color: selected[slot.id] === v.id ? "#D4A017" : "#9ca3af",
                      }}
                    >
                      {HOOK_STYLE_LABEL[v.hook_style] ?? v.hook_style}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected variant details */}
              {selVariant && (
                <div className="flex-1 flex flex-col gap-3 mb-5">
                  <div className="text-xs font-semibold text-white tracking-wide leading-relaxed p-3 bg-white/5 border border-white/5 rounded-xl border-l-2 border-l-[#D4A017] shadow-[inset_0_1px_rgba(255,255,255,0.05)] font-mono">
                    {selVariant.hook_text}
                  </div>

                  <textarea
                    value={editCaption[selVariant.id] ?? selVariant.caption}
                    onChange={e =>
                      setEditCaption(c => ({ ...c, [selVariant.id]: e.target.value }))
                    }
                    rows={4}
                    className="w-full bg-black/40 border border-white/10 rounded-xl text-gray-300 text-xs p-3 focus:outline-none focus:border-[#D4A017]/50 focus:shadow-[0_0_12px_rgba(212,160,23,0.08)] resize-y font-mono leading-relaxed"
                  />
                  
                  <div className="text-[10px] text-gray-500 font-mono italic leading-relaxed truncate">
                    {selVariant.hashtags}
                  </div>
                </div>
              )}

              {/* Actions */}
              {slot.approval_state === "queued" && (
                <div className="flex gap-3 border-t border-white/5 pt-4 mt-auto">
                  <button
                    onClick={() => approve(slot.id)}
                    disabled={busy[slot.id]}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold font-mono tracking-wide border cursor-pointer active:scale-98 transition-all"
                    style={{
                      background: busy[slot.id] ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.12)",
                      borderColor: "rgba(16,185,129,0.3)",
                      color: "#10b981",
                      opacity: busy[slot.id] ? 0.6 : 1
                    }}
                  >
                    <CheckCircle2 size={12} /> Approve
                  </button>
                  <button
                    onClick={() => reject(slot.id)}
                    disabled={busy[slot.id]}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold font-mono tracking-wide border cursor-pointer active:scale-98 transition-all"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      borderColor: "rgba(239,68,68,0.25)",
                      color: "#ef4444",
                      opacity: busy[slot.id] ? 0.6 : 1
                    }}
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          </ParallaxTiltCard>
        );
      })}
    </div>
  );
}

function CalendarPanel() {
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ig/calendar")
      .then(r => r.json())
      .then(d => {
        if (d.success) setSlots(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-mono text-xs">
        <Clock className="animate-spin mr-2" size={14} /> Loading editorial calendar...
      </div>
    );
  }

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);

  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const dayLabel = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {days.map((day, i) => {
          const iso = day.toISOString().slice(0, 10);
          const daySlots = slots.filter(s => s.post_at.startsWith(iso));
          const isToday = iso === today.toISOString().slice(0, 10);

          return (
            <div
              key={iso}
              className="p-3 bg-black/40 border rounded-xl min-h-[140px] flex flex-col transition-all relative overflow-hidden group"
              style={{
                borderColor: isToday ? "rgba(212,160,23,0.4)" : "rgba(255,255,255,0.06)",
                boxShadow: isToday ? "0 0 15px rgba(212,160,23,0.08), inset 0 0 10px rgba(212,160,23,0.05)" : "none",
              }}
            >
              {isToday && (
                <div className="absolute top-0 right-0 left-0 h-[2px] bg-[#D4A017]" />
              )}
              
              <div
                className="text-[10px] font-bold font-mono tracking-wider uppercase mb-3 flex items-center justify-between"
                style={{ color: isToday ? "#D4A017" : "#4b5563" }}
              >
                <span>{dayLabel[i]}</span>
                <span className="opacity-80">{day.getDate()}</span>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                {daySlots.map(s => (
                  <div
                    key={s.id}
                    className="p-2 rounded-lg flex flex-col gap-1 transition-all"
                    style={{
                      background: `${ACCOUNT_COLOR[s.account]}0c`,
                      borderLeft: `2px solid ${ACCOUNT_COLOR[s.account]}`,
                    }}
                  >
                    <div className="text-[9px] font-bold uppercase font-mono tracking-wide" style={{ color: ACCOUNT_COLOR[s.account] }}>
                      {s.account === "mikeb" ? "mkb.io" : "severus"}
                    </div>
                    <div className="text-[8px] text-gray-500 font-mono truncate uppercase">
                      {s.pillar.replace(/-/g, " ")}
                    </div>
                    <div className="mt-1">
                      <span
                        className="text-[8px] font-bold tracking-wider px-1 py-0.5 rounded border uppercase"
                        style={{
                          color: s.approval_state === "approved" || s.approval_state === "published" ? "#10b981" : s.approval_state === "queued" ? "#f59e0b" : "#9ca3af",
                          borderColor: s.approval_state === "approved" || s.approval_state === "published" ? "#10b98130" : s.approval_state === "queued" ? "#f59e0b30" : "#9ca3af20",
                          background: s.approval_state === "approved" || s.approval_state === "published" ? "#10b98108" : s.approval_state === "queued" ? "#f59e0b08" : "#9ca3af05",
                        }}
                      >
                        {s.approval_state}
                      </span>
                    </div>
                  </div>
                ))}
                {daySlots.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[9px] text-gray-600 font-mono italic">
                    Rest
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend & Stats */}
      <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-wrap gap-6 items-center justify-between text-xs text-gray-400 font-mono">
        <div className="flex gap-4 flex-wrap">
          {Object.entries(ACCOUNT_COLOR).map(([acc, color]) => (
            <div key={acc} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              <span className="text-gray-300 font-bold">{ACCOUNT_LABEL[acc]}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
          <Clock size={11} /> Next generation batch executes at 04:00 UTC
        </div>
      </div>
    </div>
  );
}

function PerformancePanel() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ig/metrics?range=30d")
      .then(r => r.json())
      .then(d => {
        if (d.success) setMetrics(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-mono text-xs">
        <Clock className="animate-spin mr-2" size={14} /> Loading campaigns metrics...
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="max-w-md mx-auto py-8">
        <ParallaxTiltCard className="w-full">
          <div className="p-8 flex flex-col items-center text-center bg-black/40 border border-white/10 rounded-2xl relative">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#ef4444] mb-4 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-2">No Metrics Gathered</h3>
            <p className="text-xs text-gray-400 font-mono leading-relaxed">
              Analytics metrics will populate as soon as the UGC engine publishes its first posts and the metrics pull cycle triggers (every 24h).
            </p>
          </div>
        </ParallaxTiltCard>
      </div>
    );
  }

  const sorted = [...metrics].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase font-bold bg-white/[0.02]">
                {["Account", "Pillar", "Hook", "Reach", "Sends", "Saves", "Watch(s)", "Score"].map(h => (
                  <th key={h} className="p-4 font-bold tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {sorted.map((row, idx) => {
                const isTop = idx < 2;
                const isBottom = idx >= sorted.length - 2;
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-white/[0.01] transition-colors"
                    style={{
                      background: isTop
                        ? "rgba(16,185,129,0.03)"
                        : isBottom
                        ? "rgba(239,68,68,0.02)"
                        : "transparent",
                    }}
                  >
                    <td className="p-4 font-bold" style={{ color: ACCOUNT_COLOR[row.account] }}>
                      {row.account === "mikeb" ? "mkb.io" : "severus"}
                    </td>
                    <td className="p-4">
                      <span
                        className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded border"
                        style={{
                          color: PILLAR_COLOR[row.pillar] ?? "#9ca3af",
                          borderColor: `${PILLAR_COLOR[row.pillar] ?? "#9ca3af"}20`,
                          background: `${PILLAR_COLOR[row.pillar] ?? "#9ca3af"}05`,
                        }}
                      >
                        {row.pillar.replace(/-/g, " ")}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300 font-semibold">{row.hook_style ?? "—"}</td>
                    <td className="p-4 text-gray-400 font-mono">{row.reach?.toLocaleString() ?? "—"}</td>
                    <td className="p-4 text-gray-400 font-mono">{row.sends?.toLocaleString() ?? "—"}</td>
                    <td className="p-4 text-gray-400 font-mono">{row.saves?.toLocaleString() ?? "—"}</td>
                    <td className="p-4 text-gray-400 font-mono">
                      {row.watch_time_s != null ? `${row.watch_time_s.toFixed(1)}s` : "—"}
                    </td>
                    <td className="p-4 font-bold">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] border tracking-wider font-bold"
                        style={{
                          color: row.score != null
                            ? row.score > 0.1 ? "#10b981" : row.score > 0.05 ? "#f59e0b" : "#ef4444"
                            : "#4b5563",
                          borderColor: row.score != null
                            ? row.score > 0.1 ? "#10b98135" : row.score > 0.05 ? "#f59e0b35" : "#ef444425"
                            : "#4b556315",
                          background: row.score != null
                            ? row.score > 0.1 ? "#10b98108" : row.score > 0.05 ? "#f59e0b08" : "#ef444405"
                            : "#4b556305",
                        }}
                      >
                        {row.score != null ? row.score.toFixed(3) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Formula widget */}
      <div className="p-4 bg-black/40 border border-white/5 rounded-xl text-[10px] text-gray-500 font-mono leading-relaxed">
        <div className="text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <FileText size={11} /> Performance Metric Scoring Formula
        </div>
        Score = 0.45 × (sends / reach) + 0.30 × (saves / reach) + 0.20 × (avg watch%) + 0.05 × (comments / reach)
      </div>
    </div>
  );
}

function InsightsPanel() {
  const [brief, setBrief] = useState(
    "No insights generated yet. Metrics populate after your first published posts and 24h pull cycle.\n\nManually add notes for your next ContentStrategy run:"
  );

  return (
    <div className="max-w-3xl">
      <ParallaxTiltCard className="w-full">
        <div className="p-6 flex flex-col gap-4 bg-black/50 border border-white/10 rounded-2xl relative shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-2">
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Tactical Briefing Notes</h3>
              <p className="text-[10px] text-gray-500 font-mono mt-1">
                Auto-generated after each analytics cycle. Notes will be injected into the next ContentStrategy agent run.
              </p>
            </div>
            <Brain className="text-[#D4A017] shrink-0" size={18} />
          </div>

          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            rows={10}
            className="w-full bg-black/40 border border-white/10 rounded-xl text-gray-300 text-xs p-4 focus:outline-none focus:border-[#D4A017]/50 focus:shadow-[0_0_12px_rgba(212,160,23,0.08)] resize-y font-mono leading-relaxed"
          />

          <button
            onClick={() => {
              // Placeholder
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide text-black bg-[#D4A017] hover:bg-[#D4A017]/90 active:scale-95 transition-all shadow-[0_0_15px_rgba(212,160,23,0.3)] cursor-pointer self-start"
          >
            <Save size={12} /> Save Briefing Notes
          </button>
        </div>
      </ParallaxTiltCard>
    </div>
  );
}

type Tab = "queue" | "calendar" | "performance" | "insights";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "queue", label: "Queue", icon: Inbox },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "insights", label: "Insights", icon: Brain },
];

export default function InstagramPage() {
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white overflow-hidden">
      <WebGLBackground showModel={false} />

      {/* Decorative SVG Data Flow Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.1 }}>
        <path d="M150 150 C 350 350, 150 600, 900 200 S 1100 700, 1200 450" 
              fill="none" stroke="#D4A017" strokeWidth="1" strokeDasharray="3,6" />
        <path d="M100 700 C 400 450, 700 800, 850 400 S 1000 100, 1300 250" 
              fill="none" stroke="#00FF88" strokeWidth="0.8" strokeDasharray="4,8" />
      </svg>

      <div className="relative z-10 flex-1 max-w-[1400px] mx-auto w-full px-4 pt-24 pb-8 flex flex-col">
        {/* Header Glass Card */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-pink-500/10 border border-pink-500/30 text-pink-500 shadow-[0_0_15px_rgba(239,72,175,0.2)]">
              <Instagram size={24} />
            </div>
            <div>
              <div className="text-[10px] text-[#D4A017] uppercase tracking-widest font-mono font-bold">Autonomous UGC Campaign Manager</div>
              <h1 className="text-xl font-bold tracking-wider font-mono mt-0.5">INSTAGRAM GROWTH</h1>
              <p className="text-xs text-gray-400 mt-1 font-mono">Review queue, approval flow, editorial calendar & metrics engine.</p>
            </div>
          </div>

          <div className="flex gap-3">
            {Object.entries(ACCOUNT_LABEL).map(([acc, label]) => (
              <span
                key={acc}
                className="text-[9px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shadow-md"
                style={{
                  color: ACCOUNT_COLOR[acc],
                  borderColor: `${ACCOUNT_COLOR[acc]}30`,
                  background: `${ACCOUNT_COLOR[acc]}0c`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCOUNT_COLOR[acc], boxShadow: `0 0 6px ${ACCOUNT_COLOR[acc]}` }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Tab Pills Bar */}
        <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-1 flex gap-2 w-max mb-6 shadow-lg">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                style={{
                  background: active ? "rgba(212,160,23,0.12)" : "transparent",
                  border: active ? "1px solid #D4A01740" : "1px solid transparent",
                  color: active ? "#D4A017" : "#6b7280",
                }}
              >
                <Icon size={12} className={active ? "text-[#D4A017]" : "text-gray-500"} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content panel */}
        <div className="flex-1">
          {tab === "queue" && <QueuePanel />}
          {tab === "calendar" && <CalendarPanel />}
          {tab === "performance" && <PerformancePanel />}
          {tab === "insights" && <InsightsPanel />}
        </div>
      </div>
    </div>
  );
}
