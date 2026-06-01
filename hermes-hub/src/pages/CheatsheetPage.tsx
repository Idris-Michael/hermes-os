import { useState } from "react";
import { Copy, Check, Terminal, ChevronDown, ChevronRight } from "lucide-react";

interface Cmd {
  label: string;
  cmd: string;
  note?: string;
}

interface Section {
  title: string;
  icon: string;
  color: string;
  url?: string;
  cmds: Cmd[];
}

const SECTIONS: Section[] = [
  {
    title: "Hermes Hub",
    icon: "🧠",
    color: "#D4A017",
    url: "http://localhost:3000",
    cmds: [
      { label: "Start", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\hermes-hub" && npx tsx server.ts`, note: ":3000" },
      { label: "Kill port", cmd: `npx kill-port 3000` },
      { label: "Type-check", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\hermes-hub" && npx tsc --noEmit` },
      { label: "Build", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\hermes-hub" && npx vite build` },
    ],
  },
{
    title: "Severus Social Pipeline",
    icon: "📸",
    color: "#f472b6",
    cmds: [
      { label: "Run heartbeat (one post cycle)", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\severus-social" && npx tsx --env-file=.env.local pipeline/heartbeat.ts` },
      { label: "Start approval server", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\severus-social" && npm run approve-server`, note: ":3200" },
      { label: "Run cron scheduler", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\severus-social" && npm run cron` },
      { label: "Pull analytics", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\severus-social" && npm run pull-insights` },
      { label: "Score content", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\severus-social" && npm run score` },
    ],
  },
  {
    title: "n8n Automation",
    icon: "🔄",
    color: "#f97316",
    url: "http://localhost:5678",
    cmds: [
      { label: "Start n8n (Docker)", cmd: `C:\\Users\\profs\\Documents\\Hermes\\start-n8n.ps1`, note: ":5678" },
      { label: "Stop n8n container", cmd: `docker stop n8n` },
      { label: "Check container status", cmd: `docker ps --filter name=n8n` },
      { label: "View n8n logs", cmd: `docker logs n8n --tail 50 -f` },
    ],
  },
  {
    title: "Paperclip",
    icon: "📎",
    color: "#2dd4bf",
    url: "http://localhost:3100",
    cmds: [
      { label: "Start", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\paperclip" && pnpm paperclipai run`, note: ":3100" },
      { label: "Dev mode", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\paperclip" && pnpm dev` },
      { label: "Stop all services", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\paperclip" && pnpm dev:stop` },
    ],
  },
  {
    title: "Ports & Processes",
    icon: "🔌",
    color: "#22c55e",
    cmds: [
      { label: "Kill port 3000 (hub)", cmd: `npx kill-port 3000` },
      { label: "Kill port 8082 (fcc)", cmd: `npx kill-port 8082` },
      { label: "Kill port 5678 (n8n)", cmd: `docker stop n8n` },
      { label: "Kill port 3100 (paperclip)", cmd: `npx kill-port 3100` },
      { label: "List all Node processes", cmd: `Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object Id, CPU, WorkingSet, StartTime` },
      { label: "Kill all Node processes", cmd: `Stop-Process -Name node -Force -ErrorAction SilentlyContinue` },
      { label: "What's on port X", cmd: `netstat -ano | findstr :3000` },
    ],
  },
  {
    title: "Git",
    icon: "🌿",
    color: "#4ade80",
    cmds: [
      { label: "Hub status", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\hermes-hub" && git status` },
      { label: "Hub quick commit", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\hermes-hub" && git add -A && git commit -m "chore: hub update"` },
      { label: "Social pipeline status", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\severus-social" && git status` },
      { label: "Hermes root status", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes" && git status` },
      { label: "Recent commits (hub)", cmd: `cd "C:\\Users\\profs\\Documents\\Hermes\\hermes-hub" && git log --oneline -10` },
    ],
  },
  {
    title: "Claude Code",
    icon: "🤖",
    color: "#a78bfa",
    cmds: [
      { label: "Launch Claude Code", cmd: `claude` },
      { label: "Launch via FCC proxy", cmd: `$env:ANTHROPIC_BASE_URL="http://127.0.0.1:8082"; $env:ANTHROPIC_AUTH_TOKEN="freecc"; claude` },
      { label: "Resume last session", cmd: `claude --continue` },
      { label: "Check Claude version", cmd: `claude --version` },
    ],
  },
  {
    title: "Diagnostics",
    icon: "🩺",
    color: "#fb923c",
    cmds: [
      { label: "Hub health check", cmd: `Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing | Select-Object StatusCode` },
      { label: "FCC health check", cmd: `Invoke-WebRequest -Uri http://localhost:8082/health -UseBasicParsing | Select-Object StatusCode` },
      { label: "n8n health check", cmd: `Invoke-WebRequest -Uri http://localhost:5678 -UseBasicParsing | Select-Object StatusCode` },
      { label: "Docker status", cmd: `docker info --format "{{.ServerVersion}}"` },
      { label: "Node version", cmd: `node --version` },
      { label: "Available disk space", cmd: `Get-PSDrive C | Select-Object Used, Free` },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-2 flex-shrink-0 p-1 rounded transition-colors"
      style={{ color: copied ? "#22c55e" : "#4b5563" }}
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${section.color}22` }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ borderBottom: open ? `1px solid ${section.color}15` : "none" }}
      >
        <span style={{ fontSize: 16 }}>{section.icon}</span>
        <span className="text-sm font-bold text-white flex-1">{section.title}</span>
        {section.url && (
          <a
            href={section.url}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-xs px-2 py-0.5 rounded font-mono"
            style={{ background: `${section.color}18`, color: section.color, border: `1px solid ${section.color}30` }}
          >
            {section.url.replace("http://", "")}
          </a>
        )}
        <span style={{ color: "#4b5563" }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* Commands */}
      {open && (
        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          {section.cmds.map((c, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5 group hover:bg-white/[0.02] transition-colors">
              <div className="w-40 flex-shrink-0 text-xs font-semibold pt-0.5" style={{ color: section.color }}>
                {c.label}
                {c.note && <span className="ml-1 font-mono font-normal" style={{ color: "#4b5563", fontSize: 10 }}>{c.note}</span>}
              </div>
              <div className="flex-1 flex items-start min-w-0">
                <code
                  className="text-xs flex-1 break-all leading-relaxed"
                  style={{ color: "#d1d5db", fontFamily: "JetBrains Mono, Consolas, monospace" }}
                >
                  {c.cmd}
                </code>
                <CopyButton text={c.cmd} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CheatsheetPage() {
  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? SECTIONS.map(s => ({
        ...s,
        cmds: s.cmds.filter(c =>
          c.label.toLowerCase().includes(filter.toLowerCase()) ||
          c.cmd.toLowerCase().includes(filter.toLowerCase())
        ),
      })).filter(s => s.cmds.length > 0)
    : SECTIONS;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#020503" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <Terminal size={14} style={{ color: "#D4A017" }} />
        <span className="text-xs font-bold text-white tracking-widest font-mono">DEV CHEATSHEET</span>
        <span className="text-xs font-mono" style={{ color: "#374151" }}>PowerShell</span>
        <div className="ml-auto">
          <input
            type="text"
            placeholder="filter commands..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded outline-none font-mono"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#d1d5db",
              width: 200,
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-3 max-w-4xl mx-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(560px, 1fr))" }}>
          {filtered.map(s => <SectionCard key={s.title} section={s} />)}
        </div>
      </div>
    </div>
  );
}
