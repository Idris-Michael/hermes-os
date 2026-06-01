import { useState, useEffect } from "react";
import { ExternalLink, ShieldAlert, Cpu } from "lucide-react";

interface TabConfig {
  id: string;
  label: string;
  src: string;
  telemetry: string;
}

const TABS: TabConfig[] = [
  { id: "architecture",  label: "System Architecture",    src: "/static/01_system_architecture.html", telemetry: "DECRYPTING SYSTEM BLUEPRINTS..." },
  { id: "ads-dashboard", label: "Ads Dashboard",          src: "/static/02_ads_dashboard.html",       telemetry: "PULLING CAMPAIGN TELEMETRY..." },
  { id: "restructure",   label: "Ads Restructure",        src: "/static/03_ads_restructure.html",     telemetry: "MAPPING NETWORK NODES..." },
  { id: "ga4",           label: "GA4 Attribution",        src: "/static/04_ga4_attribution.html",     telemetry: "RESOLVING CONVERSION PATHS..." },
  { id: "tech-stack",    label: "Tech Stack Mastery",     src: "/static/05_tech_stack_mastery.html",  telemetry: "COMPILING TARGET COMPONENT MAP..." },
  { id: "sc-dashboard",  label: "Severus Connects",       src: "/static/Severus_Connects_Dashboard.html", telemetry: "ESTABLISHING SEVERUS UPLINK..." },
  { id: "client-deck",   label: "Client Deck",            src: "/static/severus-client-deck/index.html", telemetry: "GENERATING SEVERUS PRESENTATION..." },
  { id: "flow-vis",      label: "Flow Visualiser",        src: "/static/severus-flow-visualiser/index.html", telemetry: "TRACE ROUTING SIGNAL PIPELINES..." },
  { id: "portfolio",     label: "Portfolio",              src: "https://severusconnects.com/",        telemetry: "PROXYING SEVERUSCONNECTS.COM..." },
];

export default function SystemPage() {
  const [active, setActive] = useState<string>(TABS[0].id);
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);
  const [errorTimeout, setErrorTimeout] = useState<boolean>(false);

  const tab = TABS.find(t => t.id === active) || TABS[0];

  // Trigger loading state on active tab shift
  const handleTabChange = (tabId: string) => {
    if (tabId === active) return;
    setIframeLoading(true);
    setErrorTimeout(false);
    setActive(tabId);
  };

  // Safe timeout fallback for loading states
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (iframeLoading) {
      timer = setTimeout(() => {
        // Safe timeout after 10s if iframe fails to load or triggers silent policies
        setErrorTimeout(true);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [iframeLoading, active]);

  return (
    <div className="flex flex-col bg-os-bg h-full overflow-hidden relative">
      {/* Tab bar (ARIA Tablist) */}
      <div 
        role="tablist"
        aria-label="System Visualizations"
        className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 overflow-x-auto shrink-0 z-10 bg-black/40 backdrop-blur-md no-scrollbar"
      >
        <div className="section-label mr-3 shrink-0 tracking-widest text-[#D4A017] font-mono select-none">VIS</div>
        
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => handleTabChange(t.id)}
            onKeyDown={(e) => {
              const idx = TABS.findIndex(item => item.id === active);
              if (e.key === "ArrowRight") {
                const nextTab = TABS[(idx + 1) % TABS.length];
                handleTabChange(nextTab.id);
                document.getElementById(`tab-${nextTab.id}`)?.focus();
              } else if (e.key === "ArrowLeft") {
                const prevTab = TABS[(idx - 1 + TABS.length) % TABS.length];
                handleTabChange(prevTab.id);
                document.getElementById(`tab-${prevTab.id}`)?.focus();
              }
            }}
            className={`shrink-0 text-xs px-3.5 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap cc-press font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#D4A017]/50 ${
              active === t.id 
                ? "bg-[#D4A017]/15 text-[#D4A017] border border-[#D4A017]/35 shadow-[0_0_12px_rgba(212,160,23,0.15)]" 
                : "text-gray-500 hover:text-gray-300 border border-transparent bg-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}

        <a
          href={tab.src}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${tab.label} in a new browser window`}
          className="ml-auto shrink-0 flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors bg-white/5 border border-white/10 px-3 py-2.5 rounded-lg cc-press font-mono focus:outline-none focus:ring-1 focus:ring-white/20"
        >
          <ExternalLink size={11} /> Open
        </a>
      </div>

      {/* iframe — fills remaining height */}
      <div className="flex-1 relative w-full h-full p-2 bg-os-bg">
        <div 
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          className="w-full h-full rounded-xl overflow-hidden border border-white/10 cc-glass shadow-2xl relative"
        >
          {/* Impeccable Telemetry Skeleton Loader */}
          {iframeLoading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#020503]/90 backdrop-blur-md select-none transition-all duration-300">
              <div className="relative flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/5 bg-black/60 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-md w-full">
                {/* Golden sweeping scanner element */}
                <div className="w-12 h-12 rounded-full border border-[#D4A017]/25 flex items-center justify-center relative overflow-hidden">
                  <Cpu className="w-5 h-5 text-[#D4A017] pulse-dot" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#D4A017]/20 via-transparent to-transparent animate-pulse" />
                </div>
                
                {/* Telemetry output */}
                <div className="flex flex-col items-center gap-1 text-center font-mono">
                  <p className="text-xs text-[#D4A017] tracking-widest uppercase animate-pulse">
                    {tab.telemetry}
                  </p>
                  <p className="text-[10px] text-gray-600 tracking-wider">
                    {errorTimeout ? "ESTABLISHING SECURE PORTAL..." : "SYNCHRONIZING HUB ASSETS..."}
                  </p>
                </div>

                {/* Laser scan line overlay */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4A017]/40 to-transparent animate-bounce" />
              </div>
            </div>
          )}

          {/* Fallback notification for safe loading failure or long latency */}
          {errorTimeout && (
            <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-black/80 border border-[#D4A017]/30 rounded-lg text-[10px] font-mono text-gray-400">
              <ShieldAlert className="w-3.5 h-3.5 text-[#D4A017]" />
              <span>Slow connection detected. Loading in background...</span>
            </div>
          )}

          <iframe
            key={active}
            src={tab.src}
            onLoad={() => setIframeLoading(false)}
            className="w-full h-full border-0 bg-os-bg transition-opacity duration-300"
            title={tab.label}
          />
        </div>
      </div>
    </div>
  );
}

