import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingBag, ChevronRight, ArrowLeft } from "lucide-react";
import VariantGrid from "../components/ugc/VariantGrid";
import type { UGCClient, UGCJob, UGCVariant } from "../types/ugc";

const STATUS_COLOR: Record<string, string> = {
  intake: "#94a3b8", approved: "#00FF88", generating: "#06b6d4",
  delivering: "#f59e0b", published: "#7C3AED",
};

interface OrderRow { client: UGCClient; job?: UGCJob; variants: UGCVariant[] }

export default function UGCOrdersPage() {
  const [params, setParams] = useSearchParams();
  const activeId = params.get("client");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ugc/orders")
      .then((r) => r.json())
      .then((data: OrderRow[]) => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const active = activeId ? orders.find((o) => o.client.id === activeId) : null;

  if (loading) return <div className="p-8 text-white/30 text-sm">Loading orders…</div>;

  if (active) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <button onClick={() => setParams({})} className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to orders
        </button>
        <div className="mb-6">
          <h2 className="text-white font-bold text-lg">{active.client.name}</h2>
          <p className="text-white/40 text-xs mt-0.5">{active.client.product_name} · {active.client.email}</p>
          {active.client.brief && <p className="text-white/60 text-sm mt-3 max-w-2xl">{active.client.brief}</p>}
        </div>
        <VariantGrid variants={active.variants} clientId={active.client.id} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)" }}>
          <ShoppingBag size={18} style={{ color: "#00FF88" }} />
        </div>
        <h1 className="text-white font-bold text-lg">UGC Orders</h1>
      </div>

      <div className="rounded-xl overflow-hidden border border-white/8" style={{ background: "rgba(255,255,255,0.02)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              {["Company", "Product", "Status", "Budget", "Spots", "Created", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-white/30 text-xs font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-white/20 text-sm">No orders yet.</td></tr>
            )}
            {orders.map(({ client }) => (
              <tr key={client.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{client.name}</td>
                <td className="px-4 py-3 text-white/60">{client.product_name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: STATUS_COLOR[client.status] ?? "#fff", background: `${STATUS_COLOR[client.status] ?? "#fff"}18` }}>
                    {client.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/60">{client.budget_gbp ? `£${client.budget_gbp}` : "—"}</td>
                <td className="px-4 py-3 text-white/60">{client.spots_purchased}</td>
                <td className="px-4 py-3 text-white/40 text-xs">{new Date(client.created_at).toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setParams({ client: client.id })} className="flex items-center gap-1 text-white/30 hover:text-[#00FF88] transition-colors text-xs">
                    View <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
