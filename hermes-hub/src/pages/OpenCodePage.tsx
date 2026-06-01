import { useState, useEffect } from "react";
import { ExternalLink, Terminal, RefreshCw } from "lucide-react";

const OC_PORT = 4200;
const OC_URL = `http://127.0.0.1:${OC_PORT}`;

export default function OpenCodePage() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${OC_URL}/api/app`, { signal: AbortSignal.timeout(2000) })
      .then(r => { setOnline(r.ok); })
      .catch(() => setOnline(false));
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "100%", overflow: "hidden" }}>
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 shrink-0">
        <Terminal size={13} style={{ color: "#D4A017" }} />
        <span className="text-xs font-bold text-white tracking-wide">OpenCode</span>
        <div className="flex items-center gap-1.5 ml-1">
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: online === true ? "#22c55e" : online === false ? "#f97316" : "#6b7280",
            boxShadow: online === true ? "0 0 6px #22c55e" : online === false ? "0 0 6px #f97316" : "none",
          }} />
          <span className="text-xs" style={{ color: online === true ? "#22c55e" : online === false ? "#f97316" : "#6b7280" }}>
            {online === true ? "RUNNING" : online === false ? "OFFLINE" : "CHECKING..."}
          </span>
        </div>
        <span className="text-xs ml-1" style={{ color: "#374151", fontFamily: "JetBrains Mono, monospace" }}>:4200</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setOnline(null); fetch(`${OC_URL}/api/app`, { signal: AbortSignal.timeout(2000) }).then(r => setOnline(r.ok)).catch(() => setOnline(false)); }}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-white transition-colors"
          >
            <RefreshCw size={11} />
          </button>
          <a href={OC_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gray-600 hover:text-white transition-colors">
            <ExternalLink size={11} /> Open
          </a>
        </div>
      </div>

      {/* Content */}
      {online === false ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ color: "#4b5563" }}>
          <Terminal size={32} style={{ color: "#D4A017", opacity: 0.4 }} />
          <div className="text-center">
            <div className="text-sm font-semibold text-white mb-1">OpenCode not running</div>
            <div className="text-xs" style={{ color: "#6b7280", maxWidth: 360 }}>
              Start the server from your terminal:
            </div>
            <pre className="mt-3 text-xs px-4 py-2 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#D4A017", fontFamily: "JetBrains Mono, monospace" }}>
              npx opencode-ai serve --port 4200 --cors http://localhost:3000
            </pre>
            <div className="text-xs mt-3" style={{ color: "#4b5563" }}>
              Config: <code style={{ color: "#818cf8" }}>Hermes/opencode.json</code>
            </div>
          </div>
          <button
            onClick={() => { setOnline(null); fetch(`${OC_URL}/api/app`, { signal: AbortSignal.timeout(2000) }).then(r => setOnline(r.ok)).catch(() => setOnline(false)); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors"
            style={{ border: "1px solid rgba(212,160,23,0.3)", color: "#D4A017" }}
          >
            <RefreshCw size={11} /> Retry connection
          </button>
        </div>
      ) : (
        <iframe
          src={OC_URL}
          className="flex-1 w-full border-0"
          style={{ minHeight: 0 }}
          title="OpenCode"
          allow="clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
