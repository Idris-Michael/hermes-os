import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, TrendingUp, Package, DollarSign } from "lucide-react";

interface UGCStats {
  pipeline_value: number;
  order_counts: Record<string, number>;
  avg_deal_size: number;
  total_orders: number;
}

const STATUS_COLOR: Record<string, string> = {
  intake: "#94a3b8", approved: "#00FF88", generating: "#06b6d4",
  delivering: "#f59e0b", published: "#7C3AED",
};

export default function UGCMetricsPage() {
  const nav = useNavigate();
  const [stats, setStats] = useState<UGCStats | null>(null);

  useEffect(() => {
    fetch("/api/ugc/metrics")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  const cards = [
    { label: "Pipeline Value", value: stats ? `£${stats.pipeline_value.toLocaleString()}` : "—", icon: DollarSign, color: "#00FF88" },
    { label: "Total Orders", value: stats?.total_orders ?? "—", icon: Package, color: "#06b6d4" },
    { label: "Avg Deal Size", value: stats ? `£${Math.round(stats.avg_deal_size)}` : "—", icon: TrendingUp, color: "#f59e0b" },
  ];

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)" }}>
          <BarChart2 size={18} style={{ color: "#00FF88" }} />
        </div>
        <h1 className="text-white font-bold text-lg">UGC Metrics</h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4 border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={14} style={{ color }} />
              <span className="text-white/40 text-xs">{label}</span>
            </div>
            <span className="text-white text-2xl font-bold">{value}</span>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="rounded-xl p-5 border mb-6" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
        <h2 className="text-white/60 text-xs font-medium mb-4 uppercase tracking-wider">Orders by Status</h2>
        <div className="space-y-3">
          {stats ? Object.entries(stats.order_counts).map(([status, count]) => (
            <div key={status} className="flex items-center gap-3">
              <span className="text-xs w-20 font-medium" style={{ color: STATUS_COLOR[status] ?? "#fff" }}>{status}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(count / (stats.total_orders || 1)) * 100}%`, background: STATUS_COLOR[status] ?? "#fff" }}
                />
              </div>
              <span className="text-white/40 text-xs w-4 text-right">{count}</span>
            </div>
          )) : <p className="text-white/20 text-sm">Loading…</p>}
        </div>
      </div>

      <button
        onClick={() => nav("/ugc/orders")}
        className="text-sm font-medium transition-colors"
        style={{ color: "#00FF88" }}
      >
        → View all orders
      </button>
    </div>
  );
}
