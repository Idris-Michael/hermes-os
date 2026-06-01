import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Send } from "lucide-react";

interface IntakeForm {
  name: string; email: string; product_name: string; product_category: string;
  tone: string; brief: string; hashtags: string; ctas: string; banned: string;
  spots_purchased: number; budget_gbp: number;
}

const EMPTY: IntakeForm = {
  name: "", email: "", product_name: "", product_category: "",
  tone: "", brief: "", hashtags: "", ctas: "", banned: "",
  spots_purchased: 5, budget_gbp: 0,
};

export default function UGCIntakePage() {
  const nav = useNavigate();
  const [form, setForm] = useState<IntakeForm>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof IntakeForm, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ugc/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          hashtag_bank: form.hashtags.split(",").map((h) => h.trim()).filter(Boolean),
          cta_variants: form.ctas.split(",").map((c) => c.trim()).filter(Boolean),
          banned_words: form.banned.split(",").map((b) => b.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      nav("/ugc/orders");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#00FF88]/50 placeholder:text-white/20";
  const labelCls = "block text-xs text-white/50 mb-1";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)" }}>
          <Package size={18} style={{ color: "#00FF88" }} />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">New UGC Order</h1>
          <p className="text-white/40 text-xs">Client intake form</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Company Name *</label>
            <input required className={inputCls} placeholder="Acme Inc" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input required type="email" className={inputCls} placeholder="hello@brand.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Product Name *</label>
            <input required className={inputCls} placeholder="SuperShake Pro" value={form.product_name} onChange={(e) => set("product_name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input className={inputCls} placeholder="Health & Fitness" value={form.product_category} onChange={(e) => set("product_category", e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Brand Tone</label>
          <input className={inputCls} placeholder="Authentic, direct, energetic" value={form.tone} onChange={(e) => set("tone", e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Campaign Brief *</label>
          <textarea required rows={4} className={inputCls} placeholder="What should the videos achieve? Who is the audience? Any specific angles?" value={form.brief} onChange={(e) => set("brief", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Hashtags (comma-separated)</label>
            <input className={inputCls} placeholder="#ugc, #sponsored" value={form.hashtags} onChange={(e) => set("hashtags", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CTAs (comma-separated)</label>
            <input className={inputCls} placeholder="Link in bio, Try free" value={form.ctas} onChange={(e) => set("ctas", e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Banned Words (comma-separated)</label>
          <input className={inputCls} placeholder="cheap, free trial, guaranteed" value={form.banned} onChange={(e) => set("banned", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Spots Purchased</label>
            <select className={inputCls} value={form.spots_purchased} onChange={(e) => set("spots_purchased", Number(e.target.value))}>
              {[3, 5, 10].map((n) => <option key={n} value={n}>{n} spots</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Budget (£)</label>
            <input type="number" min={0} className={inputCls} placeholder="500" value={form.budget_gbp || ""} onChange={(e) => set("budget_gbp", Number(e.target.value))} />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
          style={{ background: "rgba(0,255,136,0.12)", color: "#00FF88", border: "1px solid rgba(0,255,136,0.3)" }}
        >
          <Send size={15} />
          {loading ? "Submitting…" : "Submit Order"}
        </button>
      </form>
    </div>
  );
}
