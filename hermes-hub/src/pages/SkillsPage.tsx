import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Skill { id: string; name: string; description: string; }

const SKILL_CATEGORIES = [
  { num: "01", name: "DESKTOP AUTOMATION", sub: "Interact with the Mac desktop features (accessibility, …)", count: 4 },
  { num: "02", name: "AUTONOMOUS AI AGENTS", sub: "Spawning + coordinating other AI agents — claude-code, codex, opencode — as sub-tasks within a conversation.", count: 4 },
  { num: "03", name: "CREATIVE", sub: "Creative content generation — ASCII art, hand-drawn diagrams, visual design briefs.", count: 6 },
  { num: "04", name: "DATA SCIENCE", sub: "Data work — pandas, plotting, notebooks, exploratory analysis on tabular and time-series.", count: 5 },
  { num: "05", name: "DEVOPS", sub: "Infrastructure flows — Docker, GitHub Actions, and deploys.", count: 3 },
  { num: "06", name: "DIAGRAMMING", sub: "Diagram creation — Mermaid, Excalidraw, architecture flowcharts.", count: 3 },
  { num: "07", name: "EMAIL", sub: "Drafting, replying, summarising email threads. Gmail + IMAP.", count: 3 },
  { num: "08", name: "GITHUB", sub: "PR review, issue triage, repo introspection. Reads diffs, runs tests, files clean changes.", count: 4 },
  { num: "09", name: "MEDIA", sub: "Video processing, image analysis, content generation for social.", count: 5 },
  { num: "10", name: "RESEARCH", sub: "Deep web research, fact-checking, source synthesis.", count: 6 },
  { num: "11", name: "PRODUCTIVITY", sub: "Calendar, tasks, notes, scheduling across connected apps.", count: 4 },
  { num: "12", name: "FINANCE", sub: "Market data, portfolio analysis, prediction markets.", count: 3 },
  { num: "13", name: "SECURITY", sub: "Credential audit, dependency scanning, threat modelling.", count: 2 },
];

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then(setSkills).catch(() => {});
  }, []);

  const displayed = showAll ? SKILL_CATEGORIES : SKILL_CATEGORIES.slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: 280, background: "linear-gradient(135deg, #0a1520 0%, #0d1e30 50%, #080f18 100%)" }}
      >
        {/* Gothic library SVG illustration */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 280" preserveAspectRatio="xMidYMid slice" opacity="0.6">
          {/* Arched windows */}
          <path d="M100 280 L100 80 Q100 40 130 40 L200 40 Q230 40 230 80 L230 280" stroke="#2a4a6a" strokeWidth="1.5" fill="rgba(10,20,35,0.3)" />
          <path d="M350 280 L350 60 Q350 20 390 20 L460 20 Q500 20 500 60 L500 280" stroke="#2a4a6a" strokeWidth="1.5" fill="rgba(10,20,35,0.3)" />
          <path d="M700 280 L700 60 Q700 20 740 20 L810 20 Q850 20 850 60 L850 280" stroke="#2a4a6a" strokeWidth="1.5" fill="rgba(10,20,35,0.3)" />
          <path d="M970 280 L970 80 Q970 40 1000 40 L1070 40 Q1100 40 1100 80 L1100 280" stroke="#2a4a6a" strokeWidth="1.5" fill="rgba(10,20,35,0.3)" />
          {/* Bookshelves */}
          {[0, 1, 2, 3, 4].map((row) =>
            [0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={50 + col * 140}
                y={120 + row * 28}
                width={120}
                height={22}
                rx="2"
                fill={`hsl(${200 + col * 15}, 30%, ${8 + row * 2}%)`}
                stroke="#1a3050"
                strokeWidth="0.5"
              />
            ))
          )}
          {/* Hooded figure */}
          <path d="M560 280 L560 150 Q560 120 580 105 Q600 115 620 105 Q640 120 640 150 L640 280" fill="#0a1a30" />
          <ellipse cx="600" cy="102" rx="18" ry="18" fill="#0a1a30" />
          {/* Light rays */}
          {[-60, -30, 0, 30, 60].map((angle, i) => (
            <line
              key={i}
              x1="600" y1="0"
              x2={600 + Math.sin((angle * Math.PI) / 180) * 400}
              y2="280"
              stroke="#6090c0"
              strokeWidth="0.8"
              opacity="0.12"
            />
          ))}
          {/* Globe */}
          <circle cx="950" cy="180" r="30" stroke="#3a5a8a" strokeWidth="1" fill="none" opacity="0.4" />
          <ellipse cx="950" cy="180" rx="30" ry="10" stroke="#3a5a8a" strokeWidth="0.5" fill="none" opacity="0.3" />
          {/* Quill */}
          <path d="M1050 120 Q1080 140 1060 200" stroke="#5a8aaa" strokeWidth="1.5" fill="none" opacity="0.4" />
          <path d="M1050 120 Q1020 130 1060 200" stroke="#5a8aaa" strokeWidth="1" fill="none" opacity="0.3" />
        </svg>

        {/* Overlay text */}
        <div className="absolute inset-0 flex flex-col justify-end p-8">
          <div className="section-label mb-2" style={{ color: "#4a7aaa" }}>13 CATEGORIES</div>
          <h1 className="text-3xl font-bold text-white mb-2">WHAT HERMES CAN DO</h1>
          <p className="text-sm max-w-md" style={{ color: "#6b9ac0" }}>
            Skills auto-load into a conversation when relevant. Install new packs with{" "}
            <code className="font-mono text-teal-400">hermes skills install &lt;pack&gt;</code> — they appear here automatically, no restart needed.
          </p>
        </div>
      </div>

      {/* Category grid */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {displayed.map((cat, i) => (
            <motion.div
              key={cat.num}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="os-card p-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Space Grotesk" }}>
                  {cat.num}
                </span>
                <div>
                  <div className="text-xs font-bold text-white tracking-wide">{cat.name}</div>
                  <div className="section-label mt-0.5">{cat.count} SUBSKILLS</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{cat.sub}</p>
            </motion.div>
          ))}
        </div>

        {!showAll && (
          <div className="flex justify-center mt-5">
            <button
              onClick={() => setShowAll(true)}
              className="px-5 py-2 rounded-full text-xs font-semibold border border-white/15 text-gray-400 hover:border-white/30 hover:text-white transition-colors"
            >
              SHOW ALL 13 SKILLS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
