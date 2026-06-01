import { useState } from "react";
import { Map, Zap, Bot, Kanban, Brain, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LondonDashboard from "../components/overwatch/LondonDashboard";
import SwarmPanel from "../components/overwatch/SwarmPanel";
import AgentsPanel from "../components/overwatch/AgentsPanel";
import KanbanPanel from "../components/overwatch/KanbanPanel";
import TacticalAI from "../components/overwatch/TacticalAI";
import PolymarketPanel from "../components/overwatch/PolymarketPanel";

const TABS = [
  { id: "map",      label: "Map",        icon: Map },
  { id: "swarm",    label: "Swarm",      icon: Zap },
  { id: "agents",   label: "Agents",     icon: Bot },
  { id: "kanban",   label: "Kanban",     icon: Kanban },
  { id: "tactical", label: "Tactical AI",icon: Brain },
  { id: "markets",  label: "Markets",    icon: BarChart2 },
] as const;

type TabId = typeof TABS[number]["id"];

export default function OverwatchPage() {
  const [active, setActive] = useState<TabId>("map");

  return (
    <div className="flex flex-col h-full" style={{ background: "#0f1c2e" }}>
      {/* Inner tab nav */}
      <nav
        className="flex items-center gap-1 px-4 py-2 border-b border-slate-700/50 shrink-0"
        style={{ background: "rgba(30,58,95,0.6)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-2 mr-4">
          <div className="w-5 h-5 rounded-md" style={{ background: "#C9A84C" }} />
          <span className="text-xs font-bold text-white tracking-wide">Severus Overwatch</span>
        </div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              color: active === id ? "#C9A84C" : "#94a3b8",
              background: active === id ? "rgba(201,168,76,0.12)" : "transparent",
            }}
          >
            <Icon size={13} />
            {label}
            {active === id && (
              <motion.div
                layoutId="ow-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                style={{ background: "#C9A84C" }}
              />
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {active === "map"      && <LondonDashboard />}
            {active === "swarm"    && <SwarmPanel />}
            {active === "agents"   && <AgentsPanel />}
            {active === "kanban"   && <KanbanPanel />}
            {active === "tactical" && (
              <div className="h-full flex items-stretch">
                <TacticalAI onClose={() => setActive("map")} />
              </div>
            )}
            {active === "markets"  && <PolymarketPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
