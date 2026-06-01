import { Link, useLocation } from "react-router-dom";
import { Users, Sparkles, GitBranch } from "lucide-react";

interface TriadItem {
  to: string;
  label: string;
  hint: string;
  icon: typeof Users;
}

const ITEMS: TriadItem[] = [
  { to: "/agents/hermes", label: "Pantheon", hint: "agent grid",       icon: Sparkles },
  { to: "/profiles",      label: "Personas", hint: "souls + skills",   icon: Users },
  { to: "/flow",          label: "Flow",     hint: "routing diagram",  icon: GitBranch },
];

/**
 * Cross-link bar shown on Pantheon, Personas, and Flow pages so the user can
 * pivot between the three views of the agent system without going back to the
 * sidebar. Current page is shown as a marker, the other two as links.
 */
export default function AgentTriadNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Agent system views"
      className="flex items-center gap-1 px-3 py-2 rounded-lg border border-white/5 bg-black/30 backdrop-blur-sm w-fit"
    >
      <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#8e9bb0] pr-2 border-r border-white/5 mr-1">
        Agents
      </span>
      {ITEMS.map(({ to, label, hint, icon: Icon }) => {
        const isActive = pathname === to;
        return isActive ? (
          <span
            key={to}
            aria-current="page"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono"
            style={{
              background: "rgba(212,160,23,0.12)",
              border: "1px solid rgba(212,160,23,0.32)",
              color: "#D4A017",
            }}
          >
            <Icon size={12} />
            {label}
            <span className="text-[9px] text-[#D4A017]/60 ml-0.5">· {hint}</span>
          </span>
        ) : (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono text-[#8e9bb0] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
          >
            <Icon size={12} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
