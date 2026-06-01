import { useState, useEffect } from "react";
import {
  Zap, Globe, BarChart2, Palette, ShoppingBag, Mail,
  Star, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";

interface ServiceAgent {
  slug: string;
  filename: string;
  name: string;
  service: string;
  status: string;
  permission: string;
  pricing: string | null;
  track: string;
}

// ── Static service track metadata ──────────────────────────────────────────────
const TRACKS = [
  {
    id: "ads",
    label: "Google Ads & Analytics",
    icon: BarChart2,
    color: "#2dd4bf",
    price: "£1,200–£2,500/mo",
    desc: "Full GA4 setup, Shopping campaigns, Performance Max, and weekly reporting.",
  },
  {
    id: "design",
    label: "UX / Design & Build",
    icon: Palette,
    color: "#a855f7",
    price: "£2,500–£8,000 setup",
    desc: "Website builds, redesigns, design systems, motion, e-commerce, CMS, and accessibility.",
  },
  {
    id: "social",
    label: "Social Media & Content",
    icon: Globe,
    color: "#f472b6",
    price: "£800–£3,000/mo",
    desc: "Content strategy, AI-generated reels, carousels, daily posts, and social analytics.",
  },
  {
    id: "bundle",
    label: "High-Value Bundles",
    icon: Star,
    color: "#D4A017",
    price: "from £3,500 setup",
    desc: "Package C (Design + Ads) and Package D (Complete System) for SaaS and e-commerce brands.",
  },
] as const;

const BUNDLE_DETAILS: Record<string, { tagline: string; deliverables: string[]; price: string; ideal: string; color: string }> = {
  "Severus-Bundle-DesignPlusAds": {
    tagline: "Package C — Design + Ads",
    color: "#D4A017",
    price: "£3,500–£6,000 setup + £2,000–£3,500/mo",
    ideal: "SaaS or e-commerce brands needing a credible web presence + immediate paid acquisition",
    deliverables: [
      "Client brief + ICP definition",
      "Design system (tokens, Figma library)",
      "Next.js website → Vercel deploy",
      "GA4 full setup + conversion events",
      "Performance Max and/or Shopping Ads",
      "Weekly cross-channel report",
    ],
  },
  "Severus-Bundle-Complete": {
    tagline: "Package D — Complete Agency System",
    color: "#f59e0b",
    price: "£6,000–£10,000 setup + £4,000–£6,000/mo",
    ideal: "Brands that want zero internal marketing overhead — design, ads, content, and analytics in one system",
    deliverables: [
      "90-day growth roadmap",
      "Full design system + website",
      "GA4 + attribution model",
      "Performance Max + Shopping Ads",
      "30-day content calendar + daily posts",
      "2× reels/week + 2× carousels/week",
      "Monthly case study video",
      "Integrated weekly report (web + ads + social)",
    ],
  },
};

const TRACK_LABELS: Record<string, string> = {
  ads: "Ads & Analytics",
  design: "UX / Design",
  social: "Social & Content",
  bundle: "Bundle",
  ops: "Operations",
  other: "Other",
};

const TRACK_COLORS: Record<string, string> = {
  ads: "#2dd4bf",
  design: "#a855f7",
  social: "#f472b6",
  bundle: "#D4A017",
  ops: "#60a5fa",
  other: "#6b7280",
};

export default function ServicesPage() {
  const [agents, setAgents] = useState<ServiceAgent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [expandedBundle, setExpandedBundle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services/agents")
      .then(r => r.json())
      .then(d => { if (d.success) setAgents(d.agents); })
      .finally(() => setLoading(false));
  }, []);

  const bundles = agents.filter(a => a.track === "bundle");
  const filtered = filter === "all" ? agents.filter(a => a.track !== "bundle") : agents.filter(a => a.track === filter);

  const countByTrack = (id: string) => agents.filter(a => a.track === id).length;

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white overflow-hidden bg-[#020503]">

      {/* Corner brackets */}
      <div className="absolute inset-x-6 inset-y-4 pointer-events-none z-0 border border-white/[0.015] rounded-2xl">
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#D4A017]/20 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#D4A017]/20 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#D4A017]/20 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#D4A017]/20 rounded-br-lg" />
      </div>

      <div className="relative z-10 flex flex-col w-full overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto w-full space-y-8">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#D4A017] shadow-[0_0_10px_#D4A017,0_0_20px_#D4A01750]" />
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Severus Connects <span className="text-[#D4A017]" style={{ textShadow: "0 0 20px #D4A01740" }}>Services.</span>
              </h1>
            </div>
            <p className="text-[12px] font-mono text-gray-500 mt-1.5 ml-5">
              {agents.length} agents · {TRACKS.length} service tracks · pitch any project
            </p>
          </div>

          {/* Service track overview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TRACKS.map(track => {
              const Icon = track.icon;
              const count = countByTrack(track.id);
              return (
                <button
                  key={track.id}
                  onClick={() => setFilter(filter === track.id ? "all" : track.id)}
                  className="text-left p-4 rounded-2xl border transition-all duration-200"
                  style={{
                    background: filter === track.id ? `color-mix(in srgb, ${track.color} 10%, #020503)` : "rgba(10,10,14,0.8)",
                    borderColor: filter === track.id ? `${track.color}50` : "rgba(255,255,255,0.07)",
                    boxShadow: filter === track.id ? `0 0 20px ${track.color}15` : "none",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Icon size={16} style={{ color: track.color }} />
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border"
                      style={{ color: track.color, borderColor: `${track.color}30`, background: `${track.color}10` }}>
                      {count} agents
                    </span>
                  </div>
                  <div className="text-[12px] font-semibold text-white mb-1">{track.label}</div>
                  <div className="text-[10px] font-mono text-gray-500 mb-2 leading-relaxed">{track.desc}</div>
                  <div className="text-[10px] font-mono font-bold" style={{ color: track.color }}>{track.price}</div>
                </button>
              );
            })}
          </div>

          {/* Bundle spotlight */}
          <div>
            <div className="text-[9px] tracking-[0.15em] uppercase font-mono text-gray-500 mb-3 flex items-center gap-2">
              <Star size={11} className="text-[#D4A017]" />
              High-Value Bundles
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(BUNDLE_DETAILS).map(([slug, b]) => {
                const open = expandedBundle === slug;
                return (
                  <div
                    key={slug}
                    className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: `${b.color}30`, background: "rgba(10,10,14,0.9)" }}
                  >
                    <button
                      className="w-full text-left p-5"
                      onClick={() => setExpandedBundle(open ? null : slug)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: b.color }}>
                            {b.tagline}
                          </div>
                          <div className="text-[13px] font-bold text-white mb-1">{b.price}</div>
                          <div className="text-[11px] font-mono text-gray-500 leading-relaxed">{b.ideal}</div>
                        </div>
                        <div className="flex-shrink-0 mt-1">
                          {open
                            ? <ChevronUp size={14} className="text-gray-500" />
                            : <ChevronDown size={14} className="text-gray-500" />}
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">
                        <div className="text-[9px] tracking-[0.12em] uppercase font-mono mb-2" style={{ color: b.color }}>
                          Deliverables
                        </div>
                        <ul className="space-y-1.5">
                          {b.deliverables.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-[11px] font-mono text-gray-300">
                              <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
                              {d}
                            </li>
                          ))}
                        </ul>
                        {slug === "Severus-Bundle-Complete" && (
                          <div className="mt-4 pt-3 border-t border-white/[0.05]">
                            <div className="text-[9px] tracking-[0.12em] uppercase font-mono mb-2 text-gray-500">Add-Ons</div>
                            <div className="space-y-1">
                              {[
                                ["TikTok cross-posting", "+£500/mo"],
                                ["LinkedIn professional content", "+£500/mo"],
                                ["Automated email newsletter", "+£300/mo"],
                              ].map(([name, price]) => (
                                <div key={name} className="flex items-center justify-between text-[10px] font-mono">
                                  <span className="text-gray-400">{name}</span>
                                  <span style={{ color: b.color }}>{price}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent roster */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] tracking-[0.15em] uppercase font-mono text-gray-500 flex items-center gap-2">
                <Zap size={11} className="text-[#2dd4bf]" />
                Agent Roster
                {filter !== "all" && (
                  <span className="text-[#2dd4bf]">— {TRACK_LABELS[filter] ?? filter}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {["all", "ads", "design", "social", "ops"].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className="px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wide transition-all border"
                    style={filter === t ? {
                      background: `${TRACK_COLORS[t] ?? "#6b7280"}20`,
                      borderColor: `${TRACK_COLORS[t] ?? "#6b7280"}40`,
                      color: TRACK_COLORS[t] ?? "#6b7280",
                    } : { background: "transparent", borderColor: "rgba(255,255,255,0.07)", color: "#6b7280" }}
                  >
                    {t === "all" ? "All" : TRACK_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-[11px] font-mono text-gray-600 py-4">Loading agents...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filtered.map(agent => {
                  const color = TRACK_COLORS[agent.track] ?? "#6b7280";
                  return (
                    <div
                      key={agent.slug}
                      className="p-3.5 rounded-xl border border-white/[0.06] bg-black/30 hover:bg-black/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="text-[11px] font-mono font-semibold text-gray-200 leading-snug">{agent.name}</div>
                        <span
                          className="flex-shrink-0 text-[7px] font-bold font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border"
                          style={{ color, borderColor: `${color}30`, background: `${color}10` }}
                        >
                          {TRACK_LABELS[agent.track] ?? agent.track}
                        </span>
                      </div>
                      {agent.service && (
                        <div className="text-[10px] font-mono text-gray-500 leading-snug">{agent.service}</div>
                      )}
                      {agent.pricing && (
                        <div className="mt-1.5 text-[10px] font-mono font-bold" style={{ color }}>{agent.pricing}</div>
                      )}
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agent.status === "Active" ? "bg-emerald-400 shadow-[0_0_6px_#22c55e]" : "bg-gray-600"}`} />
                        <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wide">{agent.status}</span>
                        <span className="ml-auto text-[8px] font-mono text-gray-700">{agent.permission}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sandbox link */}
          <div className="flex justify-end pb-6">
            <a
              href="obsidian://open?vault=Obsidian%20Vault&file=Hermes%20OS"
              className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600 hover:text-[#D4A017] transition-colors"
            >
              <ExternalLink size={10} />
              Open in Obsidian Vault
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
