import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Zap, Brain, RefreshCw, ExternalLink } from "lucide-react";
import { useInterval } from "../../hooks/useInterval";

interface Market {
  id: string;
  question: string;
  slug: string;
  endDate: string;
  volume: string;
  liquidity: string;
  outcomes: string;
  outcomePrices: string;
  image: string;
  featured: boolean;
  new: boolean;
}

const CATEGORIES = [
  { id: "all",    label: "Top Movers",  icon: TrendingUp, tag: "" },
  { id: "ai",     label: "AI & Tech",   icon: Brain,      tag: "AI" },
  { id: "crypto", label: "Crypto",      icon: Zap,        tag: "Crypto" },
] as const;

type CatId = typeof CATEGORIES[number]["id"];

const PINNED_SLUGS = [
  "will-ai-surpass-human-performance-on-all-tasks-by-2030",
  "will-bitcoin-hit-100k-in-2025",
  "will-anthropic-release-claude-5-in-2025",
];

function parseOutcomes(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function parsePrices(raw: string): number[] {
  try { return JSON.parse(raw).map(Number); } catch { return []; }
}

function formatVolume(v: string): string {
  const n = parseFloat(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function ProbBar({ outcomes, prices }: { outcomes: string[]; prices: number[] }) {
  if (!outcomes.length || !prices.length) return null;
  const top = outcomes.slice(0, 2);
  const topP = prices.slice(0, 2);

  return (
    <div className="space-y-1.5 mt-2">
      {top.map((label, i) => {
        const pct = Math.round((topP[i] ?? 0) * 100);
        const isYes = label.toLowerCase() === "yes";
        const color = isYes ? "#22c55e" : pct > 60 ? "#C9A84C" : "#94a3b8";
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs w-16 truncate shrink-0" style={{ color: "#94a3b8" }}>{label}</span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs font-mono w-8 text-right shrink-0" style={{ color }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function MarketCard({ m, pinned }: { m: Market; pinned?: boolean }) {
  const outcomes = parseOutcomes(m.outcomes);
  const prices = parsePrices(m.outcomePrices);
  const topPrice = prices[0] ?? 0;
  const daysLeft = m.endDate
    ? Math.max(0, Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl p-4 flex flex-col gap-2 group"
      style={{
        background: pinned
          ? "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(30,58,95,0.4))"
          : "rgba(255,255,255,0.03)",
        border: pinned ? "1px solid rgba(201,168,76,0.25)" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start gap-3">
        {m.image && (
          <img
            src={m.image}
            alt=""
            className="w-9 h-9 rounded-lg object-cover shrink-0 opacity-80"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug text-white line-clamp-2 font-medium">{m.question}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs font-mono" style={{ color: "#C9A84C" }}>
              Vol {formatVolume(m.volume)}
            </span>
            {daysLeft !== null && (
              <span className="text-xs" style={{ color: "#64748b" }}>
                {daysLeft === 0 ? "Ends today" : `${daysLeft}d left`}
              </span>
            )}
            {m.new && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>
                NEW
              </span>
            )}
            <a
              href={`https://polymarket.com/event/${m.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity"
            >
              <ExternalLink size={12} color="#94a3b8" />
            </a>
          </div>
        </div>
      </div>

      <ProbBar outcomes={outcomes} prices={prices} />

      {outcomes.length > 0 && (
        <div className="flex items-center gap-1 mt-1">
          <span
            className="text-lg font-bold font-mono"
            style={{ color: topPrice > 0.6 ? "#22c55e" : topPrice > 0.4 ? "#C9A84C" : "#94a3b8" }}
          >
            {Math.round(topPrice * 100)}¢
          </span>
          <span className="text-xs" style={{ color: "#64748b" }}>
            {outcomes[0]}
          </span>
        </div>
      )}
    </motion.div>
  );
}

export default function PolymarketPanel() {
  const [cat, setCat] = useState<CatId>("all");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [pinned, setPinned] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMarkets = useCallback(async (category: CatId) => {
    setLoading(true);
    try {
      const catDef = CATEGORIES.find((c) => c.id === category)!;
      const url = catDef.tag ? `/api/polymarket?tag=${catDef.tag}` : "/api/polymarket";
      const res = await fetch(url);
      const data: Market[] = await res.json();
      setMarkets(data);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPinned = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        PINNED_SLUGS.map((slug) =>
          fetch(`https://gamma-api.polymarket.com/markets?slug=${slug}`)
            .then((r) => r.json())
            .then((d: Market[]) => d[0])
        )
      );
      const valid = results
        .filter((r): r is PromiseFulfilledResult<Market> => r.status === "fulfilled" && !!r.value)
        .map((r) => r.value);
      setPinned(valid);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchMarkets(cat);
  }, [cat, fetchMarkets]);

  useEffect(() => { fetchPinned(); }, [fetchPinned]);
  useInterval(() => fetchMarkets(cat), 60_000);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "#0f1c2e" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(30,58,95,0.4)" }}
      >
        <div>
          <h2 className="text-white font-bold tracking-wide">Polymarket</h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            Prediction markets · live odds
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs font-mono" style={{ color: "#64748b" }}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchMarkets(cat)}
            className="p-2 rounded-lg transition-colors"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <RefreshCw size={14} color="#94a3b8" className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-6 py-3 shrink-0">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCat(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              color: cat === id ? "#C9A84C" : "#64748b",
              background: cat === id ? "rgba(201,168,76,0.1)" : "transparent",
              border: cat === id ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6 space-y-6">
        {/* Pinned markets */}
        {pinned.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest mb-3 font-mono" style={{ color: "#C9A84C" }}>
              Tracked
            </p>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              {pinned.map((m) => (
                <MarketCard key={m.id} m={m} pinned />
              ))}
            </div>
          </div>
        )}

        {/* Main feed */}
        <div>
          <p className="text-xs uppercase tracking-widest mb-3 font-mono" style={{ color: "#64748b" }}>
            {CATEGORIES.find((c) => c.id === cat)?.label}
          </p>
          {loading ? (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl h-32 animate-pulse"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {markets.map((m) => (
                  <MarketCard key={m.id} m={m} />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
