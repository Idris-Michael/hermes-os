import { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  Cpu, 
  Database, 
  Network, 
  Clock, 
  Shield, 
  Sparkles, 
  RefreshCw, 
  Terminal, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp
} from "lucide-react";
import WebGLBackground from "../components/WebGLBackground";
import ParallaxTiltCard from "../components/ParallaxTiltCard";
import { motion, AnimatePresence } from "framer-motion";
import { useInterval } from "../hooks/useInterval";

interface SwarmEvent {
  id: string;
  timestamp: Date;
  agent: "hermes" | "openclaw" | "opencode" | "system";
  action: string;
  details: string;
  status: "success" | "pending" | "error" | "active";
}

interface TelemetryPoint {
  time: string;
  cpu: number;
  memory: number;
  tokens: number;
}

export default function ActivityPage() {
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<"all" | "hermes" | "openclaw" | "opencode" | "system">("all");
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<"cpu" | "memory" | "tokens">("cpu");
  const [hoveredPoint, setHoveredPoint] = useState<TelemetryPoint | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Initial Events
  const [events, setEvents] = useState<SwarmEvent[]>([
    {
      id: "1",
      timestamp: new Date(Date.now() - 2000),
      agent: "hermes",
      action: "OBSIDIAN_SYNC",
      details: "synced 8 new nodes to memory graph",
      status: "success"
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 8000),
      agent: "openclaw",
      action: "TWITTER_POST",
      details: "dispatched scheduled update to server",
      status: "pending"
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 15000),
      agent: "opencode",
      action: "NEXTJS_BUILD",
      details: "running webpack optimization suite",
      status: "active"
    },
    {
      id: "4",
      timestamp: new Date(Date.now() - 24000),
      agent: "system",
      action: "SPEECH_SYNTH",
      details: "supertonic TTS voice buffer populated",
      status: "success"
    },
    {
      id: "5",
      timestamp: new Date(Date.now() - 40000),
      agent: "system",
      action: "CACHE_PURGE",
      details: "purged edge cache paths /api/memory/*",
      status: "success"
    },
    {
      id: "6",
      timestamp: new Date(Date.now() - 60000),
      agent: "hermes",
      action: "DECK_RELOAD",
      details: "reloaded agent personas deck of cards",
      status: "success"
    }
  ]);

  // Telemetry stream data
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);

  // Generate initial historical telemetry points
  useEffect(() => {
    const points: TelemetryPoint[] = [];
    const now = Date.now();
    for (let i = 20; i >= 0; i--) {
      const t = new Date(now - i * 5000);
      points.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        cpu: Math.floor(40 + Math.sin(i * 0.5) * 15 + Math.random() * 8),
        memory: Math.floor(65 + Math.cos(i * 0.3) * 5 + Math.random() * 3),
        tokens: Math.floor(72 + Math.sin(i * 0.2) * 8 + Math.random() * 4)
      });
    }
    setTelemetry(points);
  }, []);

  // Live simulator for telemetry stream and ticker events (paused when tab hidden)
  useInterval(() => {
      // 1. Update Telemetry
      setTelemetry(prev => {
        const nextTime = new Date();
        const last = prev[prev.length - 1];
        const newCpu = Math.max(10, Math.min(100, Math.floor((last?.cpu || 50) + (Math.random() - 0.5) * 12)));
        const newMemory = Math.max(30, Math.min(100, Math.floor((last?.memory || 60) + (Math.random() - 0.5) * 4)));
        const newTokens = Math.max(40, Math.min(100, Math.floor((last?.tokens || 75) + (Math.random() - 0.5) * 5)));
        
        const nextPoints = [
          ...prev.slice(1),
          {
            time: nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            cpu: newCpu,
            memory: newMemory,
            tokens: newTokens
          }
        ];
        return nextPoints;
      });

      // 2. Randomly add new Swarm events
      if (Math.random() > 0.6) {
        const actions: { agent: SwarmEvent["agent"]; action: string; details: string; status: SwarmEvent["status"] }[] = [
          { agent: "hermes", action: "COGNITIVE_DREAM", details: "staged candidate lessons to review queue", status: "success" },
          { agent: "openclaw", action: "MCP_QUERY", details: "queried knowledge document search engines", status: "success" },
          { agent: "opencode", action: "LINT_FIX", details: "resolved typescript compilation warnings", status: "success" },
          { agent: "system", action: "VOICEOVER_COMPOSER", details: "synthesized voice track for severus reels", status: "active" },
          { agent: "hermes", action: "MEMORY_CONSTELLATION", details: "added new semantic decision node to memory graph", status: "success" },
          { agent: "openclaw", action: "FIREBASE_DEPLOY", details: "dispatched frontend bundle to production edge servers", status: "pending" }
        ];

        const picked = actions[Math.floor(Math.random() * actions.length)];
        const newEvent: SwarmEvent = {
          id: Math.random().toString(),
          timestamp: new Date(),
          ...picked
        };

        setEvents(prev => [newEvent, ...prev.slice(0, 19)]);
      }
  }, isLive ? 3000 : null);

  // SVG Line Chart math
  const chartWidth = 500;
  const chartHeight = 160;
  const padding = 15;

  const activePoints = useMemo(() => {
    return telemetry.map(t => {
      if (activeTelemetryTab === "cpu") return t.cpu;
      if (activeTelemetryTab === "memory") return t.memory;
      return t.tokens;
    });
  }, [telemetry, activeTelemetryTab]);

  const svgPath = useMemo(() => {
    if (activePoints.length === 0) return "";
    const xStep = (chartWidth - padding * 2) / (activePoints.length - 1);
    
    return activePoints.reduce((path, val, idx) => {
      const xCoord = padding + idx * xStep;
      // Invert Y coordinate because SVG Y starts from top
      const yCoord = chartHeight - padding - (val / 100) * (chartHeight - padding * 2);
      return idx === 0 ? `M ${xCoord} ${yCoord}` : `${path} L ${xCoord} ${yCoord}`;
    }, "");
  }, [activePoints]);

  const svgAreaPath = useMemo(() => {
    if (activePoints.length === 0) return "";
    const xStep = (chartWidth - padding * 2) / (activePoints.length - 1);
    
    let path = svgPath;
    const startX = padding;
    const endX = padding + (activePoints.length - 1) * xStep;
    const baseY = chartHeight - padding;
    
    return `${path} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  }, [activePoints, svgPath]);

  // Event filter selection
  const filteredEvents = useMemo(() => {
    if (selectedAgentFilter === "all") return events;
    return events.filter(e => e.agent === selectedAgentFilter);
  }, [events, selectedAgentFilter]);

  // System gauges calculations
  const gauges = [
    { name: "TTS Engine", value: 92, stroke: "#10b981", subtitle: "Synthesis buffer active", icon: Cpu },
    { name: "Swarm Sync", value: 97, stroke: "#D4A017", subtitle: "Latency below 40ms", icon: Network },
    { name: "Obsidian Graph", value: 84, stroke: "#10b981", subtitle: "Semantic linkages synced", icon: Database },
    { name: "CDN Cache", value: 99, stroke: "#10b981", subtitle: "Edge delivery success", icon: Shield }
  ];

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white overflow-hidden">
      <WebGLBackground showModel={false} />
      
      {/* Dynamic Animated Decorative SVG Network Connection Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.12 }}>
        <path d="M 100 200 C 300 150, 400 350, 600 200 S 800 100, 1100 300" 
          fill="none" stroke="#D4A017" strokeWidth="1.5" strokeDasharray="6 18"
          style={{ animation: "dash 25s linear infinite" }} />
        <path d="M 1200 400 C 900 300, 800 600, 500 500 S 300 200, 0 400" 
          fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="4 12"
          style={{ animation: "dash 18s linear infinite reverse" }} />
      </svg>
      
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }
      `}</style>

      <div className="relative z-10 flex flex-col w-full h-full bg-black/40 backdrop-blur-sm overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6 w-full flex flex-col h-full">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#D4A017] pulse-dot" style={{ boxShadow: "0 0 10px #D4A017, 0 0 20px #D4A01750" }} />
                <h1 className="text-2xl font-semibold tracking-tight">
                  Telemetry & <span className="text-[#D4A017]" style={{ textShadow: "0 0 20px rgba(212, 160, 23, 0.4)" }}>SWARM Activity</span>
                </h1>
              </div>
              <p className="text-gray-400 text-xs mt-1.5 ml-5">
                Real-time multi-agent operations feed, Obsidian memory graph telemetry, and system resources.
              </p>
            </div>
            
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                isLive 
                  ? "bg-[#D4A017]/10 border-[#D4A017]/30 text-[#D4A017] shadow-[0_0_12px_rgba(212,160,23,0.15)]" 
                  : "bg-white/5 border-white/10 text-gray-400"
              }`}
            >
              <RefreshCw size={12} className={isLive ? "animate-spin" : ""} />
              {isLive ? "LIVE TELEMETRY STREAMING" : "STREAMING PAUSED"}
            </button>
          </div>

          {/* System Health circular gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gauges.map((gauge) => {
              const Icon = gauge.icon;
              const radius = 32;
              const circumference = 2 * Math.PI * radius;
              const offset = circumference - (gauge.value / 100) * circumference;

              return (
                <ParallaxTiltCard key={gauge.name} className="p-4">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="flex justify-between items-center w-full text-xs text-gray-500 font-mono">
                      <span className="font-semibold uppercase tracking-wider">{gauge.name}</span>
                      <Icon size={12} style={{ color: gauge.stroke }} />
                    </div>
                    
                    {/* SVG Gauge */}
                    <div className="relative w-20 h-20">
                      <svg className="w-full h-full transform -rotate-90">
                        {/* Background circle */}
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke="rgba(255, 255, 255, 0.04)"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        {/* Progress circle */}
                        <motion.circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke={gauge.stroke}
                          strokeWidth="4.5"
                          fill="transparent"
                          strokeDasharray={circumference}
                          initial={{ strokeDashoffset: circumference }}
                          animate={{ strokeDashoffset: offset }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Central Value */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold font-mono tracking-tight">{gauge.value}%</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 font-mono">
                      {gauge.subtitle}
                    </div>
                  </div>
                </ParallaxTiltCard>
              );
            })}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Telemetry Resource Line Chart Card */}
            <div className="md:col-span-2">
              <ParallaxTiltCard className="p-5 flex flex-col h-full justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-[#D4A017]" />
                      <span className="text-xs font-bold uppercase tracking-wider">System Resource Telemetry</span>
                    </div>
                    
                    {/* Tab controllers */}
                    <div className="flex gap-1 bg-black/40 border border-white/5 p-0.5 rounded-md">
                      {(["cpu", "memory", "tokens"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => {
                            setActiveTelemetryTab(tab);
                            setHoveredPoint(null);
                          }}
                          className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded transition-all ${
                            activeTelemetryTab === tab 
                              ? "bg-white/10 text-white font-semibold" 
                              : "text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SVG Chart display */}
                  <div className="relative w-full bg-black/30 border border-white/5 rounded-lg p-3 overflow-hidden">
                    <svg 
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                      className="w-full h-auto overflow-visible"
                      onMouseLeave={() => setHoveredPoint(null)}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const xRatio = (e.clientX - rect.left) / rect.width;
                        const idx = Math.round(xRatio * (telemetry.length - 1));
                        if (idx >= 0 && idx < telemetry.length) {
                          setHoveredPoint(telemetry[idx]);
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={activeTelemetryTab === "cpu" ? "#D4A017" : "#10b981"} stopOpacity="0.2" />
                          <stop offset="100%" stopColor={activeTelemetryTab === "cpu" ? "#D4A017" : "#10b981"} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid lines */}
                      {[0, 25, 50, 75, 100].map((level) => {
                        const yCoord = chartHeight - padding - (level / 100) * (chartHeight - padding * 2);
                        return (
                          <g key={level}>
                            <line 
                              x1={padding} 
                              y1={yCoord} 
                              x2={chartWidth - padding} 
                              y2={yCoord} 
                              stroke="rgba(255,255,255,0.03)" 
                              strokeWidth="1" 
                            />
                            <text 
                              x={padding - 4} 
                              y={yCoord + 3} 
                              fill="rgba(255,255,255,0.15)" 
                              fontSize="8" 
                              fontFamily="monospace"
                              textAnchor="end"
                            >
                              {level}%
                            </text>
                          </g>
                        );
                      })}

                      {/* Area Fill */}
                      <path 
                        d={svgAreaPath} 
                        fill="url(#chartGradient)" 
                        className="transition-all duration-300"
                      />

                      {/* Main Stroke Line */}
                      <path 
                        d={svgPath} 
                        fill="none" 
                        stroke={activeTelemetryTab === "cpu" ? "#D4A017" : "#10b981"} 
                        strokeWidth="1.5" 
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />

                      {/* Telemetry points */}
                      {telemetry.map((pt, i) => {
                        const val = activeTelemetryTab === "cpu" ? pt.cpu : activeTelemetryTab === "memory" ? pt.memory : pt.tokens;
                        const xStep = (chartWidth - padding * 2) / (telemetry.length - 1);
                        const cx = padding + i * xStep;
                        const cy = chartHeight - padding - (val / 100) * (chartHeight - padding * 2);
                        const isHovered = hoveredPoint?.time === pt.time;

                        return (
                          <circle 
                            key={i}
                            cx={cx} 
                            cy={cy} 
                            r={isHovered ? 4 : 2}
                            fill={isHovered ? "#fff" : activeTelemetryTab === "cpu" ? "#D4A017" : "#10b981"}
                            className="transition-all duration-150 cursor-crosshair"
                          />
                        );
                      })}
                    </svg>

                    {/* Telemetry overlay details */}
                    <div className="mt-3 flex justify-between items-center text-[10px] font-mono text-gray-500">
                      <div>GRID_RESOLUTION: 5.0S/DIV</div>
                      <div className="flex gap-3">
                        <span className={activeTelemetryTab === "cpu" ? "text-[#D4A017]" : ""}>CPU: {telemetry[telemetry.length - 1]?.cpu}%</span>
                        <span className={activeTelemetryTab === "memory" ? "text-[#10b981]" : ""}>RAM: {telemetry[telemetry.length - 1]?.memory}%</span>
                        <span className={activeTelemetryTab === "tokens" ? "text-[#10b981]" : ""}>TOK: {telemetry[telemetry.length - 1]?.tokens}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hover Coordinate Tracking */}
                <div className="mt-4 p-2.5 rounded border border-white/5 bg-black/60 font-mono text-[11px]">
                  {hoveredPoint ? (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">COORDINATE_FOCUS: {hoveredPoint.time}</span>
                      <div className="flex gap-4">
                        <span>CPU: <strong className="text-white">{hoveredPoint.cpu}%</strong></span>
                        <span>MEM: <strong className="text-white">{hoveredPoint.memory}%</strong></span>
                        <span>TOK: <strong className="text-white">{hoveredPoint.tokens}%</strong></span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-600 animate-pulse">MOVE CURSOR OVER CHART GRID TO FOCUS DATAPOINTS</span>
                  )}
                </div>
              </ParallaxTiltCard>
            </div>

            {/* Live SWARM Event Ticker Card */}
            <div>
              <ParallaxTiltCard className="p-5 flex flex-col h-full space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-[#D4A017]" />
                    <span className="text-xs font-bold uppercase tracking-wider">SWARM Event Feed</span>
                  </div>
                  <TrendingUp size={12} className="text-emerald-500" />
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap gap-1">
                  {(["all", "hermes", "openclaw", "opencode", "system"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setSelectedAgentFilter(f)}
                      className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-all border ${
                        selectedAgentFilter === f 
                          ? "bg-[#D4A017]/10 border-[#D4A017]/40 text-[#D4A017] shadow-sm" 
                          : "bg-white/2 border-white/5 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Live ticker block */}
                <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                  <AnimatePresence initial={false}>
                    {filteredEvents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <AlertCircle size={16} className="text-gray-600 mb-2" />
                        <span className="text-gray-500 text-xs font-mono">NO ACTIVE CYCLES FILTERED</span>
                      </div>
                    ) : (
                      filteredEvents.map((evt) => {
                        let badgeColor = "border-gray-500/20 text-gray-400 bg-gray-500/5";
                        if (evt.agent === "hermes") badgeColor = "border-amber-500/30 text-[#D4A017] bg-amber-500/5";
                        if (evt.agent === "openclaw") badgeColor = "border-red-500/30 text-red-400 bg-red-500/5";
                        if (evt.agent === "opencode") badgeColor = "border-blue-500/30 text-blue-400 bg-blue-500/5";

                        return (
                          <motion.div
                            key={evt.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="p-2.5 rounded border border-white/5 bg-white/2 hover:bg-white/4 hover:border-white/10 transition-all font-mono text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 rounded border text-[9px] uppercase font-bold tracking-wider ${badgeColor}`}>
                                {evt.agent}
                              </span>
                              <span className="text-gray-600 text-[10px]">
                                {evt.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-gray-300 font-semibold mb-0.5">{evt.action}</div>
                            <div className="text-gray-400 text-[10px] leading-relaxed">{evt.details}</div>
                            
                            {/* Status indicator line */}
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                evt.status === "success" ? "bg-emerald-500" :
                                evt.status === "pending" ? "bg-yellow-500" :
                                evt.status === "active" ? "bg-blue-500 animate-pulse" : "bg-red-500"
                              }`} />
                              <span className="text-gray-500 text-[9px] uppercase font-bold">{evt.status}</span>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              </ParallaxTiltCard>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
