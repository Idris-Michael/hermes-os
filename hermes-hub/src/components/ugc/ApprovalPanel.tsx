import { useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";

interface ApprovalPanelProps {
  selectedIds: string[];
  clientId: string;
  onClear: () => void;
}

export default function ApprovalPanel({ selectedIds, clientId, onClear }: ApprovalPanelProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleApprove() {
    setLoading(true);
    try {
      await fetch(`/api/ugc/orders/${clientId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_ids: selectedIds }),
      });
      setDone(true);
      setTimeout(onClear, 1500);
    } catch {
      // surface via console — don't swallow silently
      console.error("Approval request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border"
      style={{
        background: "rgba(10,10,15,0.95)",
        borderColor: "rgba(0,255,136,0.3)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 40px rgba(0,255,136,0.1)",
      }}
    >
      <span className="text-white/60 text-sm">{selectedIds.length} selected</span>

      <a
        href={`/api/ugc/orders/${clientId}/download?ids=${selectedIds.join(",")}`}
        download
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
      >
        <Download size={14} />
        Download Zip
      </a>

      <button
        onClick={handleApprove}
        disabled={loading || done}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
        style={{ background: done ? "#00FF88" : "rgba(0,255,136,0.15)", color: done ? "#000" : "#00FF88", border: "1px solid rgba(0,255,136,0.4)" }}
      >
        <CheckCircle2 size={14} />
        {done ? "Approved!" : loading ? "Approving…" : "Approve"}
      </button>
    </div>
  );
}
