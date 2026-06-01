import { useState, useEffect } from "react";
import { Bot, ExternalLink, RefreshCw, Search } from "lucide-react";
import { motion } from "framer-motion";

interface Agent {
  slug: string;
  model: string;
  provider: string;
  base_url: string;
  tier: string;
}

const TIER_BADGE: Record<string, string> = {
  Cerebras: "bg-emerald-100 text-emerald-800",
  DeepSeek: "bg-blue-100 text-blue-800",
  OpenRouter: "bg-amber-100 text-amber-800",
  Claude: "bg-purple-100 text-purple-800",
  Local: "bg-slate-100 text-slate-700",
};

const TIER_DOT: Record<string, string> = {
  Cerebras: "bg-emerald-400",
  DeepSeek: "bg-blue-400",
  OpenRouter: "bg-amber-400",
  Claude: "bg-purple-400",
  Local: "bg-slate-400",
};

const TIER_CARD_ACCENT: Record<string, string> = {
  Cerebras: "border-emerald-500/30",
  DeepSeek: "border-blue-500/30",
  OpenRouter: "border-amber-500/30",
  Claude: "border-purple-500/30",
  Local: "border-slate-600/30",
};

function slugToTitle(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function shortModel(model: string): string {
  if (model.length <= 28) return model;
  return model.slice(0, 26) + "…";
}

export default function AgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/agents");
      const data: Agent[] = await r.json();
      setAgents(data);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgents(); }, []);

  const filtered = agents.filter((a) =>
    search === "" ||
    a.slug.toLowerCase().includes(search.toLowerCase()) ||
    a.tier.toLowerCase().includes(search.toLowerCase()) ||
    a.model.toLowerCase().includes(search.toLowerCase())
  );

  const tierCounts: Record<string, number> = {};
  for (const a of agents) tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;

  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(135deg, #0f1c2e 0%, #1a2d45 100%)" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Hermes Agents</h1>
            <p className="text-slate-400 text-sm mt-1">{agents.length} profiles loaded</p>
          </div>
          <button onClick={fetchAgents} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700/50 hover:border-slate-500/50 transition-all" style={{ background: "rgba(30,58,95,0.4)" }}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          {Object.entries(tierCounts).map(([tier, count]) => (
            <div key={tier} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700/50 text-xs font-medium" style={{ background: "rgba(30,58,95,0.4)" }}>
              <div className={`w-2 h-2 rounded-full ${TIER_DOT[tier] || "bg-slate-400"}`} />
              <span className="text-slate-300">{tier}</span>
              <span className="text-slate-500">({count})</span>
            </div>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by name, tier, or model…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 border border-slate-600/50 focus:outline-none focus:border-amber-500/60 transition-colors"
            style={{ background: "rgba(0,0,0,0.3)" }}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-700/30 p-4 animate-pulse" style={{ background: "rgba(30,58,95,0.3)" }}>
                <div className="h-4 bg-slate-700/50 rounded mb-3 w-3/4" />
                <div className="h-3 bg-slate-700/30 rounded mb-2 w-full" />
                <div className="h-3 bg-slate-700/30 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filtered.map((agent, i) => (
              <motion.div
                key={agent.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`rounded-xl border p-4 hover:bg-white/5 transition-all group ${TIER_CARD_ACCENT[agent.tier] || "border-slate-600/30"}`}
                style={{ background: "rgba(30,58,95,0.4)" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,76,0.15)" }}>
                      <Bot size={16} style={{ color: "#C9A84C" }} />
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_BADGE[agent.tier] || TIER_BADGE.Local}`}>
                    {agent.tier}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-white leading-tight mb-1 group-hover:text-amber-300 transition-colors">
                  {slugToTitle(agent.slug)}
                </h3>
                <p className="text-xs text-slate-500 font-mono mb-2">{agent.slug}</p>

                <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-700/30">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-600 w-16 shrink-0">Model</span>
                    <span className="text-xs text-slate-300 font-mono truncate" title={agent.model}>{shortModel(agent.model)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-600 w-16 shrink-0">Provider</span>
                    <span className="text-xs text-slate-400">{agent.provider}</span>
                  </div>
                  {agent.base_url && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-600 w-16 shrink-0">Endpoint</span>
                      <a
                        href={agent.base_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors truncate max-w-[100px]"
                        title={agent.base_url}
                      >
                        <ExternalLink size={10} />
                        {agent.base_url.replace(/^https?:\/\//, "").split("/")[0]}
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                No agents match your search.
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
