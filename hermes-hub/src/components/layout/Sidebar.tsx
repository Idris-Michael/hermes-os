import { NavLink } from "react-router-dom";
import { Home, Zap, Brain, Activity, Users, Mic } from "lucide-react";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/skills", label: "Skills", icon: Zap },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/profiles", label: "Profiles", icon: Users },
  { to: "/voiceover", label: "Voiceover", icon: Mic },
];

export default function Sidebar() {
  return (
    <aside className="os-sidebar">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold" style={{ background: "#D4A017", color: "#000" }}>
            C
          </div>
          <div>
            <div className="text-white text-xs font-bold leading-tight">Claude Code OS</div>
            <div className="section-label" style={{ fontSize: 9 }}>OPERATOR</div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="pt-3 pb-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
          >
            <Icon size={14} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Hermes Command */}
      <div className="px-4 pt-3 pb-1">
        <div className="section-label mb-2">Command</div>
      </div>
      <NavLink
        to="/chat"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
        style={({ isActive }) => isActive ? {} : {}}
      >
        <span style={{ fontSize: 13 }}>⚔️</span>
        Hermes Command
      </NavLink>

      {/* Agents section */}
      <div className="px-4 pt-4 pb-2">
        <div className="section-label mb-2">Agents</div>
      </div>

      <NavLink
        to="/agents/hermes"
        className={({ isActive }) => `agent-pill hermes cc-press cc-glow-gold${isActive ? " ring-2 ring-yellow-400/40" : ""}`}
      >
        HERMES-AGENT
      </NavLink>

      <NavLink
        to="/agents/openclaw"
        className={({ isActive }) =>
          `agent-pill openclaw cc-press mt-1${isActive ? " border-red-400/80 text-red-300" : ""}`
        }
      >
        <span className="mr-1" style={{ fontSize: 13 }}>🦀</span>
        OPENCLAW
      </NavLink>

{/* Growth section */}
      <div className="px-4 pt-4 pb-2">
        <div className="section-label mb-2">Growth</div>
      </div>
      <NavLink
        to="/services"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>💼</span>
        Services
      </NavLink>
      <NavLink
        to="/instagram"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>📸</span>
        Instagram
      </NavLink>
      <NavLink
        to="/discovery"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>🔭</span>
        Discovery
      </NavLink>
      <NavLink
        to="/knowledge"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>📚</span>
        Knowledge Base
      </NavLink>
      <NavLink
        to="/openshorts"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>✂️</span>
        OpenShorts
      </NavLink>
      <NavLink
        to="/voicebox"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>🎙️</span>
        Voicebox
      </NavLink>
      <NavLink
        to="/openscreen"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>🖥️</span>
        OpenScreen
      </NavLink>

      {/* UGC section */}
      <div className="px-4 pt-4 pb-2">
        <div className="section-label mb-2">UGC</div>
      </div>
      <NavLink to="/ugc/new" className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}>
        <span style={{ fontSize: 13 }}>➕</span>
        New Order
      </NavLink>
      <NavLink to="/ugc/orders" className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}>
        <span style={{ fontSize: 13 }}>📦</span>
        Orders
      </NavLink>
      <NavLink to="/ugc/metrics" className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}>
        <span style={{ fontSize: 13 }}>📊</span>
        Metrics
      </NavLink>

      {/* Overwatch link */}
      <div className="px-4 pt-4 pb-2">
        <div className="section-label mb-2">Systems</div>
      </div>
      <NavLink
        to="/cheatsheet"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>⌨️</span>
        Cheatsheet
      </NavLink>
      <NavLink
        to="/overwatch"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>⚡</span>
        Overwatch
      </NavLink>
      <NavLink
        to="/system"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>🧠</span>
        VIS
      </NavLink>
      <NavLink
        to="/onboarding"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>🚀</span>
        Onboarding
      </NavLink>
      <NavLink
        to="/ecc"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>⚡</span>
        ECC
      </NavLink>
      <NavLink
        to="/flow"
        className={({ isActive }) => `nav-link cc-press${isActive ? " active" : ""}`}
      >
        <span style={{ fontSize: 13 }}>⬡</span>
        Flow
      </NavLink>

      <div className="flex-1" />

      {/* Paperclip link */}
      <div className="px-4 pb-3">
        <a
          href="http://127.0.0.1:3100"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded text-xs cc-press"
          style={{ color: "#4b5563", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#D4A017")}
          onMouseLeave={e => (e.currentTarget.style.color = "#4b5563")}
        >
          <span style={{ fontSize: 12 }}>📎</span>
          <span>Paperclip</span>
          <span className="ml-auto" style={{ fontSize: 9, color: "#2dd4bf" }}>:3100</span>
        </a>
      </div>
    </aside>
  );
}
