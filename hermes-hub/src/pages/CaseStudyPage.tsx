import { useState } from "react";
import { Play, Monitor, Brain, Instagram, Globe, Video, Activity, ChevronRight, ExternalLink } from "lucide-react";
import WebGLBackground from "../components/WebGLBackground";

interface Section {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  videoFile: string;
  color: string;
  stack: string[];
  description: string;
  metric?: string;
}

const SECTIONS: Section[] = [
  {
    id: "home",
    number: "01",
    title: "Dashboard",
    subtitle: "Central command",
    icon: <Activity size={16} />,
    videoFile: "/case-study/01-home.mp4",
    color: "#e94560",
    stack: ["React 19", "Vite", "Express", "SQLite"],
    description: "React 19 + Vite SPA served by Express on port 3000. Real-time run log reads from SQLite via better-sqlite3. Stats cards pull live from /api/health, /api/tasks, and the IG pipeline DB.",
    metric: "< 50ms API response",
  },
  {
    id: "agents",
    number: "02",
    title: "Agent Hub",
    subtitle: "Persona system",
    icon: <Brain size={16} />,
    videoFile: "/case-study/02-agents.mp4",
    color: "#a78bfa",
    stack: ["TypeScript", "SQLite", "Telegram Bot API"],
    description: "Agent profiles stored as JSON with model routing (Qwen3, DeepSeek, Claude), skill bindings, and tool permissions. Task queue is SQLite-backed FIFO feeding the Telegram gateway. Personas organised by suit/rank with individual soul files.",
    metric: "8 active agents",
  },
  {
    id: "instagram",
    number: "03",
    title: "Instagram Pipeline",
    subtitle: "4-layer AI content engine",
    icon: <Instagram size={16} />,
    videoFile: "/case-study/03-instagram.mp4",
    color: "#f59e0b",
    stack: ["Qwen3-32B", "Gemini TTS", "Hyperframes", "Telegram"],
    description: "Qwen3-32B generates 5 hook variants → Gemini Cloud TTS produces voiceover → Hyperframes renders MP4 reel → Telegram bot delivers thumbnail with HMAC-signed approve/reject links (6-hour TTL). Fully automated or human-in-the-loop.",
    metric: "~$0.21/month running cost",
  },
  {
    id: "knowledge",
    number: "04",
    title: "Knowledge Base",
    subtitle: "3D constellation graph",
    icon: <Globe size={16} />,
    videoFile: "/case-study/04-knowledge.mp4",
    color: "#10b981",
    stack: ["Three.js", "React Three Fiber", "WebGL"],
    description: "Force-directed 3D constellation — 180 settle iterations at boot, 4,000-particle swarm morphing between formations (sphere, helix, donut). Nodes sourced live from Claude memory files, agent definitions, Obsidian vault, and plans.",
    metric: "4,000 particles",
  },
  {
    id: "openscreen",
    number: "05",
    title: "OpenScreen",
    subtitle: "Native screen capture",
    icon: <Monitor size={16} />,
    videoFile: "/case-study/05-openscreen.mp4",
    color: "#6b7280",
    stack: ["Electron", "Windows WGC", "C++ Native Bridge"],
    description: "Electron desktop app using Windows Graphics Capture APIs for zero-lag recording. Auto-zoom on click events, cursor motion blur, MP4 export. Pipeline bridge: OpenScreen → HyperFrames layer → motion graphics → final reel.",
    metric: "60fps · zero-lag capture",
  },
  {
    id: "overwatch",
    number: "06",
    title: "Overwatch",
    subtitle: "London intelligence dashboard",
    icon: <Video size={16} />,
    videoFile: "/case-study/06-overwatch.mp4",
    color: "#3b82f6",
    stack: ["MapLibre GL", "TfL API", "Polymarket", "Claude Sonnet"],
    description: "Real-time London dashboard: TfL tube/overground status, road disruptions, JamCam feeds. Polymarket prediction markets panel with live prices. Tactical AI panel streaming Claude Sonnet analysis — all proxied through the Express backend.",
    metric: "Live TfL + Polymarket data",
  },
];

function VideoPlayer({ src, color }: { src: string; color: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{
        background: "rgba(0,0,0,0.6)",
        border: `1px solid ${color}33`,
        aspectRatio: "16/9",
      }}
    >
      <video
        src={src}
        className="w-full h-full object-cover"
        loop
        muted
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={(e) => {
          const v = e.currentTarget;
          v.paused ? v.play() : v.pause();
        }}
      />
      {!playing && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => {
            const video = e.currentTarget.previousElementSibling as HTMLVideoElement;
            video?.play();
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: color, opacity: 0.9 }}
          >
            <Play size={20} color="#fff" style={{ marginLeft: 2 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaseStudyPage() {
  const [active, setActive] = useState<string>("home");
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="relative min-h-screen" style={{ background: "#060610" }}>
      <WebGLBackground />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(233,69,96,0.12)", color: "#e94560", border: "1px solid rgba(233,69,96,0.25)" }}>
              CASE STUDY
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Severus Connects · 2025</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Hermes Hub</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Agency automation OS — GA4 analytics · AI ads · Instagram pipeline · Real-time intelligence
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* Section nav */}
          <div className="col-span-3">
            <div className="sticky top-6 space-y-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-3"
                  style={{
                    background: active === s.id ? `${s.color}14` : "transparent",
                    border: `1px solid ${active === s.id ? s.color + "40" : "transparent"}`,
                  }}
                >
                  <span className="text-xs font-mono" style={{ color: active === s.id ? s.color : "rgba(255,255,255,0.25)" }}>
                    {s.number}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: active === s.id ? "#fff" : "rgba(255,255,255,0.5)" }}>
                      {s.title}
                    </div>
                    <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {s.subtitle}
                    </div>
                  </div>
                  {active === s.id && <ChevronRight size={12} style={{ color: s.color, marginLeft: "auto", flexShrink: 0 }} />}
                </button>
              ))}

              {/* LinkedIn CTA */}
              <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <a
                  href="https://www.linkedin.com/in/idris-michael-bakare/"
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg w-full"
                  style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  <ExternalLink size={11} />
                  Connect on LinkedIn
                </a>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="col-span-9 space-y-5">

            {/* Video */}
            <VideoPlayer src={section.videoFile} color={section.color} />

            {/* Section header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${section.color}18`, color: section.color }}>
                    {section.icon}
                  </span>
                  <h2 className="text-lg font-bold text-white">{section.title}</h2>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {section.description}
                </p>
              </div>
              {section.metric && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs font-mono px-2 py-1 rounded" style={{ background: `${section.color}14`, color: section.color, border: `1px solid ${section.color}33` }}>
                    {section.metric}
                  </div>
                </div>
              )}
            </div>

            {/* Stack pills */}
            <div className="flex flex-wrap gap-2">
              {section.stack.map((tech) => (
                <span
                  key={tech}
                  className="text-xs px-2.5 py-1 rounded font-mono"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {tech}
                </span>
              ))}
            </div>

            {/* Pipeline overview (shown on first section) */}
            {active === "home" && (
              <div className="p-4 rounded-xl" style={{ background: "rgba(233,69,96,0.04)", border: "1px solid rgba(233,69,96,0.12)" }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#e94560" }}>
                  Full System Architecture
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Content Engine", detail: "Qwen3-32B → 5 hook variants → Gemini TTS → Hyperframes MP4" },
                    { label: "Control Layer", detail: "Telegram bot gateway → agent task queue → pipeline triggers" },
                    { label: "Analytics", detail: "GA4 + Google Ads API → Polymarket → TfL real-time feeds" },
                  ].map(({ label, detail }) => (
                    <div key={label} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</div>
                      <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
