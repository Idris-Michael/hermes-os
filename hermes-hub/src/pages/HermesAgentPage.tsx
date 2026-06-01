import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X, Plus } from "lucide-react";
import WebGLBackground from "../components/WebGLBackground";
import TelegramConsole from "../components/TelegramConsole";
import AgentTriadNav from "../components/AgentTriadNav";
import { useInterval } from "../hooks/useInterval";
import { useProfiles, useSwarmLogs } from "../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";

const EMPTY_PERSONAS: never[] = [];

const INTEGRATION_CATEGORIES: Record<string, string[]> = {
  "CORE APIS": ["API", "OpenAI Codex", "Anthropic API"],
  "CHANNELS & WORKSPACE": ["Telegram", "Gmail", "Google Drive", "Google Calendar"],
  "MCP KNOWLEDGE": ["Obsidian Vault", "NotebookLM", "Notion", "Agentpedia"],
  "SYSTEM ARCHITECTURE": ["Supabase", "Granola", "Higgsfield", "Stitch", "n8n"]
};

const SUIT_SYMBOLS: Record<string, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_BG: Record<string, string> = { spades: "#0c1228", hearts: "#1a0c18", diamonds: "#1a1408", clubs: "#0c1a14" };

interface ProfilePersona {
  id: string; name: string; suit: string; rank: string;
  role: string; modelLabel: string; modelColor: string;
  badge: string; synced: boolean; accentColor: string;
  imageUrl?: string;
  tagline?: string;
  skills?: string[];
  tools?: { id: string; label: string; description: string; }[];
}

interface Message { role: "user" | "assistant"; content: string; }

interface StatData {
  model: string; provider: string; budget_used: number; budget_max: number;
  sessions: number; messages: number; last_active: string;
}

const DEMO_STATS: StatData = {
  model: "gpt-3.5", provider: "via GOOGLE CODEX",
  budget_used: 440, budget_max: 101000,
  sessions: 12, messages: 248, last_active: "2m ago",
};

export default function HermesAgentPage() {
  const [online, setOnline] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [activeTab, setActiveTab] = useState("API");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [stats] = useState<StatData>(DEMO_STATS);
  const [showNewPersona, setShowNewPersona] = useState(false);
  const queryClient = useQueryClient();
  const { data: profilesData } = useProfiles();
  const personas = useMemo(
    () => (profilesData ?? EMPTY_PERSONAS) as unknown as ProfilePersona[],
    [profilesData],
  );
  const [selectedPersona, setSelectedPersona] = useState<ProfilePersona | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [assigningTask, setAssigningTask] = useState(false);
  const [suitFilter, setSuitFilter] = useState<string>("all");
  
  // Hero Hover & Cursor tracking states
  const [heroHover, setHeroHover] = useState(false);
  const [heroMouse, setHeroMouse] = useState({ x: 0.5, y: 0.5 });
  const heroRef = useRef<HTMLDivElement>(null);

  // Interactive HUD Hover Highlight state
  const [activeHeroSys, setActiveHeroSys] = useState<string | null>(null);

  // Avatar Selection States
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState("auto");
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");

  // Chat Telemetry states
  const [showTelemetry, setShowTelemetry] = useState(false);

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setHeroMouse({ x, y });
  };

  const handleHeroMouseLeave = () => {
    setHeroHover(false);
    setHeroMouse({ x: 0.5, y: 0.5 });
    setActiveHeroSys(null);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add Persona Form States
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newSuit, setNewSuit] = useState("spades");
  const [newRank, setNewRank] = useState("jack");
  const [newTagline, setNewTagline] = useState("");
  const [newModelLabel, setNewModelLabel] = useState("QWEN-3.6");
  const [newModelColor, setNewModelColor] = useState("#8b5cf6");
  const [newAccentColor, setNewAccentColor] = useState("#8b5cf6");
  const [newSkills, setNewSkills] = useState("");

  // /api/profiles is fetched via TanStack Query — see useProfiles() above.

  useEffect(() => {
    fetch("/hermes-proxy/health", { signal: AbortSignal.timeout(2000) })
      .then((r) => { if (r.ok) { setOnline(true); setDemoMode(false); } })
      .catch(() => { setOnline(false); setDemoMode(true); });
  }, []);

  const { data: swarmLogData } = useSwarmLogs(2500);
  const swarmLogs = swarmLogData?.lines ?? [];
  // swarmRunning isn't referenced in the JSX (was previously stored but never read in render);
  // keep the boolean derivation cheap if a future caller needs it:
  // const swarmRunning = swarmLogData?.running ?? false;

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setStreaming(true);

    try {
      if (online) {
        const res = await fetch("/hermes-proxy/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input.trim() }),
        });
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMsg = "";
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantMsg += decoder.decode(value, { stream: true });
          setMessages((m) => { const copy = [...m]; copy[copy.length - 1].content = assistantMsg; return copy; });
        }
      } else {
        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMsg.content }),
        });
        const data = await res.json();
        setMessages((m) => [...m, { role: "assistant", content: data.reply || "No response." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connection error." }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleCreatePersona = async () => {
    if (!newName.trim() || !newRole.trim()) return;
    
    // Generate a unique ID
    const id = newName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

    const selectedImageUrl = selectedAvatarPreset === "auto" 
      ? `/assets/agents/${newRank}-of-${newSuit}.png` 
      : (customAvatarUrl.trim() || `/assets/agents/${newRank}-of-${newSuit}.png`);
    
    const payload = {
      id,
      name: newName.toUpperCase(),
      suit: newSuit,
      rank: newRank,
      role: newRole,
      tagline: newTagline,
      model: newModelLabel === "CLAUDE-3.5" ? "anthropic/claude-3.5-sonnet" :
             newModelLabel === "GPT-4O" ? "openai/gpt-4o" :
             newModelLabel === "GEMINI-1.5" ? "google/gemini-1.5-pro" :
             "huggingface/Qwen/Qwen3.6:novita",
      modelLabel: newModelLabel,
      modelColor: newModelColor,
      accentColor: newAccentColor,
      skills: newSkills.split(",").map(s => s.trim()).filter(Boolean),
      imageUrl: selectedImageUrl,
      tools: [
        { id: `${id}-tool-1`, label: `${newRole} Core`, description: `Specialized tools for executing ${newRole} tasks.` }
      ]
    };

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await res.json();
        await queryClient.invalidateQueries({ queryKey: ["profiles"] });
        setShowNewPersona(false);
        // Clear fields
        setNewName("");
        setNewRole("");
        setNewTagline("");
        setNewSkills("");
        setSelectedAvatarPreset("auto");
        setCustomAvatarUrl("");
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "Failed to create persona"}`);
      }
    } catch (e) {
      alert("Failed to submit to server.");
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const budgetPct = Math.round((stats.budget_used / stats.budget_max) * 100);
  const sessionBars = Array.from({ length: 12 }, () => Math.floor(Math.random() * 8) + 2);

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white overflow-hidden">
      <WebGLBackground />
      <div className="relative z-10 flex flex-col w-full h-full bg-black/20 backdrop-blur-md">
      <div className="px-6 pt-4"><AgentTriadNav /></div>
      {/* Hero Banner — cloaked figure under stone arch, blue-grey engraving style with dynamic HUD and mouse tracking */}
      <div 
        ref={heroRef}
        onMouseEnter={() => setHeroHover(true)}
        onMouseLeave={handleHeroMouseLeave}
        onMouseMove={handleHeroMouseMove}
        className="w-full relative overflow-hidden transition-all duration-500 ease-in-out border-b border-blue-500/10 group" 
        style={{ height: 240, background: "#060913" }}
      >
        {/* Sleek scanlines & digital grid background overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(13,25,47,0.15)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none z-10 opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,25,47,0.05)_1px,transparent_1px)] bg-[size:40px_100%] pointer-events-none z-10" />

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1400 240" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="skyGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#081426" />
              <stop offset="100%" stopColor="#030710" />
            </linearGradient>
            <linearGradient id="archFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1a355a" stopOpacity={heroHover ? "0.6" : "0.4"} />
              <stop offset="100%" stopColor="#050a14" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="bottomFade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="#070c14" />
            </linearGradient>
            <radialGradient
              id="archGlow"
              cx={`${50 + (heroMouse.x - 0.5) * 15}%`}
              cy={`${30 + (heroMouse.y - 0.5) * 15}%`}
              r="40%"
            >
              <stop offset="0%" stopColor="#2563eb" stopOpacity={heroHover ? "0.45" : "0.25"} />
              <stop offset="60%" stopColor="#1d4ed8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id="portalGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="30%" stopColor="#1d4ed8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <style>{`
            @keyframes float-rune {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-12px) rotate(8deg); }
            }
            @keyframes pulse-staff {
              0%, 100% { r: 4; fill: #93c5fd; filter: drop-shadow(0 0 4px #3b82f6); }
              50% { r: 6.5; fill: #ffffff; filter: drop-shadow(0 0 12px #60a5fa); }
            }
            @keyframes scanline-crawl {
              0% { transform: translateY(-100%); }
              100% { transform: translateY(100%); }
            }
          `}</style>

          {/* Sky background */}
          <rect width="1400" height="240" fill="url(#skyGrad)" />
          <rect width="1400" height="240" fill="url(#archGlow)" />

          {/* Hatching texture lines — engraving style */}
          {Array.from({ length: 30 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 8} x2="1400" y2={i * 8} stroke="#172554" strokeWidth="0.4" opacity="0.25" />
          ))}

          {/* Stone wall texture left */}
          {Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 6 }, (_, c) => (
              <rect key={`bl${r}-${c}`} x={c * 80} y={r * 30} width={76} height={26} rx="1"
                fill="none" stroke="#1d4ed8" strokeWidth="0.5" opacity={heroHover ? "0.3" : "0.15"} className="transition-all duration-500" />
            ))
          )}
          {/* Stone wall right */}
          {Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 6 }, (_, c) => (
              <rect key={`br${r}-${c}`} x={960 + c * 80} y={r * 30} width={76} height={26} rx="1"
                fill="none" stroke="#1d4ed8" strokeWidth="0.5" opacity={heroHover ? "0.3" : "0.15"} className="transition-all duration-500" />
            ))
          )}

          {/* Distant sky glow through arch */}
          <ellipse cx="700" cy="80" rx="160" ry="100" fill="#1e40af" opacity="0.2" />

          {/* Mountains through arch — lighter for contrast */}
          <path d="M480 240 L520 130 L560 160 L610 85 L660 140 L700 108 L740 150 L780 78 L820 130 L920 240Z" fill="#172554" />
          <path d="M500 240 L550 150 L600 175 L660 118 L720 158 L780 108 L840 148 L920 240Z" fill="#1e3a8a" />
          <path d="M500 240 L560 185 L640 200 L700 175 L780 190 L840 205 L920 240Z" fill="#0f172a" />

          {/* Glowing portal inside the archway when hovered */}
          <ellipse cx="700" cy="130" rx="120" ry="90" fill="url(#portalGlow)" opacity={heroHover ? "0.55" : "0.15"} className="transition-all duration-500" />

          {/* Arch outer — brighter stroke */}
          <path d="M480 240 L480 80 Q480 20 560 20 L840 20 Q920 20 920 80 L920 240"
            stroke={heroHover ? "#60a5fa" : "#3b82f6"} strokeWidth="3" fill="url(#archFill)" className="transition-all duration-500" />
          {/* Arch inner */}
          <path d="M510 240 L510 90 Q510 50 570 50 L830 50 Q890 50 890 90 L890 240"
            stroke="#2563eb" strokeWidth="2" fill="none" opacity="0.8" />
          {/* Arch detail lines */}
          <path d="M540 240 L540 100 Q540 70 585 70 L815 70 Q860 70 860 100 L860 240"
            stroke="#1d4ed8" strokeWidth="1.2" fill="none" opacity="0.6" />
          {/* Keystone at arch top */}
          <path d="M680 22 L700 10 L720 22Z" fill="#2563eb" opacity="0.8" />

          {/* Left column — visible masonry */}
          <rect x="458" y="75" width="26" height="165" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5" opacity="0.8" />
          <rect x="455" y="65" width="32" height="14" rx="2" fill="#2563eb" stroke="#60a5fa" strokeWidth="1" opacity="1" />
          {/* Column hatching */}
          {Array.from({ length: 5 }, (_, i) => (
            <line key={`lc${i}`} x1="460" y1={80 + i * 30} x2="482" y2={80 + i * 30} stroke="#3b82f6" strokeWidth="0.8" opacity="0.5" />
          ))}
          {/* Right column */}
          <rect x="916" y="75" width="26" height="165" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5" opacity="0.8" />
          <rect x="913" y="65" width="32" height="14" rx="2" fill="#2563eb" stroke="#60a5fa" strokeWidth="1" opacity="1" />
          {Array.from({ length: 5 }, (_, i) => (
            <line key={`rc${i}`} x1="918" y1={80 + i * 30} x2="940" y2={80 + i * 30} stroke="#3b82f6" strokeWidth="0.8" opacity="0.5" />
          ))}

          {/* Light rays — interactive tracking */}
          {[-50,-30,-15,0,15,30,50].map((a, i) => {
            const angleRad = (a * Math.PI) / 180;
            const dx = (heroMouse.x - 0.5) * 110;
            const dy = (heroMouse.y - 0.5) * 30;
            return (
              <line key={`ray${i}`}
                x1={700 + (heroMouse.x - 0.5) * 20} 
                y1={20}
                x2={700 + Math.sin(angleRad) * 500 + dx}
                y2={240 + dy}
                stroke="#93c5fd"
                strokeWidth={i === 3 ? 2 : 1}
                opacity={heroHover ? (i === 3 ? 0.45 : 0.18) : (i === 3 ? 0.35 : 0.12)}
                className="transition-all duration-300 ease-out"
              />
            );
          })}

          {/* Cyber Sigils/Runes floating in the archway */}
          {[
            { char: "♠", x: 615, y: 155, delay: "0s", speed: "6s", label: "INTEL" },
            { char: "♦", x: 785, y: 145, delay: "1.5s", speed: "7s", label: "DEEP" },
            { char: "♣", x: 575, y: 95, delay: "3s", speed: "5s", label: "SWARM" },
            { char: "♥", x: 825, y: 115, delay: "4.5s", speed: "8s", label: "TASK" },
            { char: "Ψ", x: 700, y: 70, delay: "2s", speed: "9s", label: "HERMES" }
          ].map((rune, idx) => {
            const offsetX = (heroMouse.x - 0.5) * (30 + idx * 8);
            const offsetY = (heroMouse.y - 0.5) * (15 + idx * 4);
            const isRuneActive = activeHeroSys === rune.label;
            return (
              <g 
                key={`rune-${idx}`} 
                transform={`translate(${rune.x + offsetX}, ${rune.y + offsetY})`} 
                className="transition-transform duration-500 ease-out pointer-events-auto cursor-pointer"
                onMouseEnter={() => {
                  setHeroHover(true);
                  setActiveHeroSys(rune.label);
                }}
                onMouseLeave={() => {
                  setActiveHeroSys(null);
                }}
              >
                <text
                  textAnchor="middle"
                  fill={isRuneActive ? "#D4A017" : "#93c5fd"}
                  fontSize="13"
                  fontWeight="bold"
                  opacity={isRuneActive ? "1" : (heroHover ? "0.85" : "0.3")}
                  style={{
                    animation: `float-rune ${rune.speed} infinite ease-in-out`,
                    animationDelay: rune.delay,
                    textShadow: isRuneActive
                      ? "0 0 10px rgba(212, 160, 23, 0.8)"
                      : "0 0 6px rgba(147, 197, 253, 0.5)",
                    transform: isRuneActive ? "scale(1.2)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  {rune.char}
                </text>
                {(heroHover || isRuneActive) && (
                  <text
                    y="10"
                    textAnchor="middle"
                    fill={isRuneActive ? "#D4A017" : "#3b82f6"}
                    fontSize="6"
                    fontFamily="monospace"
                    letterSpacing="1"
                    opacity={isRuneActive ? "1" : "0.7"}
                    fontWeight={isRuneActive ? "bold" : "normal"}
                  >
                    {rune.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Cloaked figure — light engraving style (bright on dark) */}
          {/* Ground shadow */}
          <ellipse cx="700" cy="236" rx="55" ry="6" fill="#020617" opacity="0.9" />
          {/* Cloak body — ivory/cream fill for visibility */}
          <path d="M658 240 L652 158 Q647 128 678 112 Q700 105 700 105 Q722 105 742 112 Q762 128 748 158 L742 240Z"
            fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.2" opacity="0.95" />
          {/* Cloak shading — inner dark folds */}
          <path d="M670 240 L665 162 Q663 138 680 122" stroke="#2563eb" strokeWidth="1.5" fill="none" opacity="0.7" />
          <path d="M730 240 L735 162 Q737 138 720 122" stroke="#2563eb" strokeWidth="1.5" fill="none" opacity="0.7" />
          <path d="M700 240 L700 165 Q700 140 700 120" stroke="#3b82f6" strokeWidth="1" fill="none" opacity="0.5" />
          {/* Hood — slightly darker than cloak body */}
          <ellipse cx="700" cy="103" rx="24" ry="24" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1.5" opacity="0.95" />
          {/* Hood peak */}
          <path d="M682 92 Q700 74 718 92" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1.5" opacity="0.95" />
          {/* Face shadow inside hood */}
          <ellipse cx="700" cy="108" rx="14" ry="12" fill="#0f172a" opacity="0.7" />
          
          {/* Staff — bright interactive glowing tip */}
          <line x1="745" y1="110" x2="795" y2="238" stroke="#eff6ff" strokeWidth="3" opacity="0.95" />
          <circle cx="794" cy="237" r="5" fill="#93c5fd" stroke="#eff6ff" strokeWidth="1" opacity="0.9" />
          
          {/* Staff magic tip */}
          <circle cx="745" cy="108" r="4.5" fill="#ffffff" style={{ animation: "pulse-staff 2s infinite ease-in-out" }} />
          
          {heroHover && (
            <>
              {/* Secondary expanding magic ring */}
              <circle cx="745" cy="108" r="14" fill="none" stroke="#60a5fa" strokeWidth="1" opacity="0.3" className="animate-ping" />
              {/* Digital indicator pointer */}
              <path d="M730 108 L720 108" stroke="#3b82f6" strokeWidth="1.5" opacity="0.8" />
              <text x="715" y="110" textAnchor="end" fill="#60a5fa" fontSize="7" fontFamily="monospace" letterSpacing="1" opacity="0.9">STAFF_EMIT</text>
            </>
          )}

          {/* Floor stones */}
          <line x1="480" y1="237" x2="920" y2="237" stroke="#2563eb" strokeWidth="1" opacity="0.6" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`fs${i}`} x1={540 + i * 60} y1={237} x2={540 + i * 60} y2={240} stroke="#1d4ed8" strokeWidth="0.8" opacity="0.5" />
          ))}

          {/* Dynamic HUD Interactive Crosshair and grid overlay when hovered */}
          {heroHover && (
            <g opacity="0.5">
              {/* Horizontal cursor tracker line */}
              <line x1="0" y1={heroMouse.y * 240} x2="1400" y2={heroMouse.y * 240} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3 6" />
              {/* Vertical cursor tracker line */}
              <line x1={heroMouse.x * 1400} y1="0" x2={heroMouse.x * 1400} y2="240" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3 6" />
              {/* Circular scope */}
              <circle cx={heroMouse.x * 1400} cy={heroMouse.y * 240} r="20" fill="none" stroke="#60a5fa" strokeWidth="1" className="animate-spin-slow" strokeDasharray="5 5" />
              <circle cx={heroMouse.x * 1400} cy={heroMouse.y * 240} r="4" fill="#60a5fa" />
            </g>
          )}

          {/* Tactical HUD Data Overlay */}
          <g opacity={heroHover ? "0.95" : "0.55"} className="transition-opacity duration-300">
            <rect x="1170" y="15" width="215" height="60" rx="3" fill="#000000" fillOpacity="0.45" stroke="#1d4ed8" strokeWidth="0.5" />
            <text x="1375" y="30" textAnchor="end" fill="#60a5fa" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">
              [HERMES DIGITAL ARCHIVE]
            </text>
            <text x="1375" y="45" textAnchor="end" fill="#93c5fd" fontSize="9" fontFamily="monospace" letterSpacing="1">
              LOC: X:{((heroMouse.x - 0.5) * 1400).toFixed(0)} | Y:{((0.5 - heroMouse.y) * 240).toFixed(0)}
            </text>
            <text x="1375" y="60" textAnchor="end" fill={online ? "#10b981" : "#ef4444"} fontSize="8" fontFamily="monospace" fontWeight="bold">
              SYS_CHANNEL // {online ? "PROJECTION_LIVE" : "SIMULATED_DECK"}
            </text>
          </g>

          <g opacity={heroHover ? "0.9" : "0.5"}>
            <rect x="15" y="55" width="130" height="40" rx="3" fill="#000000" fillOpacity="0.4" stroke="#1d4ed8" strokeWidth="0.5" />
            <text x="25" y="68" fill="#60a5fa" fontSize="8" fontFamily="monospace">SWARM ENGINE: ACTIVE</text>
            <text x="25" y="80" fill="#93c5fd" fontSize="8" fontFamily="monospace">PERSONAS: {personas.length}</text>
            <text x="25" y="90" fill="#4b5563" fontSize="6" fontFamily="monospace">VER: 3.6.0-DELTA</text>
          </g>

          {/* Real-time Telemetry HUD box in the Hero Banner */}
          <g opacity={heroHover ? "0.95" : "0.75"} className="transition-opacity duration-300">
            <rect x="15" y="105" width="410" height="90" rx="4" fill="#000000" fillOpacity="0.65" stroke="#2563eb" strokeWidth="0.5" />
            <text x="25" y="122" fill="#2dd4bf" fontSize="8" fontFamily="monospace" fontWeight="bold" letterSpacing="0.8">
              [SWARM TELEMETRY STREAM]
            </text>
            <circle cx="150" cy="119" r="2.5" fill="#2dd4bf" className="animate-pulse" />
            {(() => {
              const logs = swarmLogs.slice(-4);
              if (logs.length === 0) {
                return (
                  <text x="25" y="145" fill="#4b5563" fontSize="8" fontFamily="monospace" fontStyle="italic">
                    Waiting for swarm logs stream...
                  </text>
                );
              }
              return logs.map((log, idx) => (
                <text 
                  key={`hud-log-${idx}`} 
                  x="25" 
                  y={142 + idx * 13} 
                  fill="#93c5fd" 
                  fontSize="7.5" 
                  fontFamily="monospace"
                  opacity={0.5 + (idx * 0.15)}
                >
                  &gt; {log.length > 82 ? log.substring(0, 79) + "..." : log}
                </text>
              ));
            })()}
          </g>

          {/* Bottom fade overlay */}
          <rect width="1400" height="240" fill="url(#bottomFade)" />
        </svg>

        {/* Sidebar label overlay */}
        <div className="absolute top-3 left-4 flex items-center gap-2 z-20">
          <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold shadow-[0_0_8px_rgba(212,160,23,0.4)]" style={{ background: "#D4A017", color: "#000" }}>H</div>
          <span className="text-white text-xs font-bold uppercase tracking-wider" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Hermes Deck</span>
          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${online ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"}`}>
            {online ? "ONLINE" : "DEMO_MODE"}
          </span>
        </div>
      </div>

      {/* High-Fidelity Status Banner */}
      {demoMode && (
        <div className="relative overflow-hidden border-b border-yellow-500/10 px-5 py-3 bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-transparent backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse-slow">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(212,160,23,0.05)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-yellow-500 shadow-[0_0_8px_#facc15]"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-wider text-yellow-400 font-mono">
                HERMES DECK: DEMO MODE ACTIVE
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5 font-mono">
                Unable to query local Hermes proxy on port 8642. Displaying local simulated profiles.
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 relative z-10 shrink-0">
            <button
              onClick={() => {
                fetch("/hermes-proxy/health", { signal: AbortSignal.timeout(1500) })
                  .then((r) => { if (r.ok) { setOnline(true); setDemoMode(false); } })
                  .catch(() => {});
              }}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/50 transition-all hover:scale-[1.02]"
            >
              <RefreshCw size={11} className="animate-spin-slow" /> CONNECT PROXY
            </button>
            <button
              onClick={() => setDemoMode(false)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X size={11} /> BYPASS
            </button>
          </div>
        </div>
      )}

      {/* Categorized Integration Tabs */}
      <div className="px-5 py-3 border-b border-white/5 bg-black/10 flex flex-col md:flex-row gap-4 items-start md:items-center">
        {Object.entries(INTEGRATION_CATEGORIES).map(([category, tabs]) => (
          <div key={category} className="flex flex-col gap-1 w-full md:w-auto">
            <span className="text-[9px] font-bold text-gray-500 tracking-wider uppercase">{category}</span>
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded transition-colors"
                  style={{
                    background: activeTab === tab ? "rgba(212,160,23,0.18)" : "rgba(255,255,255,0.03)",
                    color: activeTab === tab ? "#D4A017" : "#8e9bb0",
                    border: `1px solid ${activeTab === tab ? "rgba(212,160,23,0.3)" : "rgba(255,255,255,0.04)"}`,
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeTab === "Agentpedia" && (
        <iframe
          src="https://agentpedia.codes/rules"
          className="w-full border-0"
          style={{ height: "calc(100vh - 160px)" }}
          title="Agentpedia Rules"
        />
      )}

      {activeTab === "Telegram" && (
        <div className="p-5">
          <TelegramConsole />
        </div>
      )}

      {activeTab !== "Agentpedia" && activeTab !== "Telegram" && <div className="p-5 space-y-5">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Active Model */}
          <div className="os-card p-4 flex flex-col justify-between">
            <div>
              <div className="section-label mb-2">Active Intelligence</div>
              {personas.length > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shadow-[0_0_15px_var(--model-glow)]"
                    style={{ 
                      background: `${personas[0].modelColor}20`, 
                      color: personas[0].modelColor,
                      border: `1px solid ${personas[0].modelColor}50`,
                      // @ts-ignore
                      "--model-glow": `${personas[0].modelColor}40`
                    }}
                  >
                    {personas[0].name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm tracking-wide">{personas[0].modelLabel}</div>
                    <div className="text-gray-500 text-[11px] font-mono mt-0.5">{personas[0].role}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 text-sm font-bold">G</div>
                  <div>
                    <div className="text-white font-semibold text-sm">{stats.model}</div>
                    <div className="text-gray-500 text-xs">{stats.provider}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-mono uppercase">SWARM PRIMARY</span>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold tracking-wider" 
                style={{ 
                  background: `${personas[0]?.modelColor || "#f59e0b"}20`, 
                  color: personas[0]?.modelColor || "#f59e0b",
                  border: `1px solid ${personas[0]?.modelColor || "#f59e0b"}40`
                }}
              >
                {personas[0]?.badge || "LOCAL"}
              </span>
            </div>
          </div>

          {/* Budget */}
          <div className="os-card p-4">
            <div className="section-label mb-2">Budget</div>
            <div className="text-2xl font-bold text-white">{(stats.budget_used / 1000).toFixed(1)}k</div>
            <div className="text-xs text-gray-500">/ {(stats.budget_max / 1000).toFixed(1)}k GRAN</div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-teal-400" style={{ width: `${budgetPct}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">{budgetPct}% FULL</div>
          </div>

          {/* Sessions */}
          <div className="os-card p-4">
            <div className="section-label mb-2">Sessions</div>
            <div className="text-3xl font-bold text-white">{stats.sessions}</div>
            <div className="flex items-end gap-0.5 mt-2 h-8">
              {sessionBars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${(h / 10) * 100}%`,
                    background: i > sessionBars.length - 4 ? "#D4A017" : "rgba(212,160,23,0.3)",
                  }}
                />
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">1d total · 30 day</div>
          </div>
        </div>

        {/* Chat */}
        <div className="os-card overflow-hidden">
          <div
            className="min-h-64 flex flex-col"
            style={{ maxHeight: 420 }}
          >
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <div className="font-display text-5xl tracking-widest mb-3" style={{ color: "#D4A017" }}>
                  HERMES-AGENT
                </div>
                <div className="text-gray-500 text-sm font-mono">&gt; START A NEW CONVERSATION</div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: m.role === "assistant" ? "#D4A017" : "#374151", color: m.role === "assistant" ? "#000" : "#fff" }}
                    >
                      {m.role === "assistant" ? "H" : "U"}
                    </div>
                    <div
                      className="max-w-lg rounded-xl px-3 py-2 text-sm"
                      style={{
                        background: m.role === "assistant" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
                        color: "#e5e7eb",
                      }}
                    >
                      {m.content}
                      {streaming && i === messages.length - 1 && m.role === "assistant" && (
                        <span className="inline-block w-1 h-3 bg-teal-400 ml-0.5 animate-pulse" />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <div className="border-t border-white/5 p-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="> Continue this conversation... (drop or paste an image)"
                className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none font-mono"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                className="px-3 py-1 rounded text-xs font-bold transition-colors disabled:opacity-40"
                style={{ background: "#D4A017", color: "#000" }}
              >
                SEND
              </button>
            </div>
          </div>
        </div>

        {/* Session Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "SESSIONS", value: stats.sessions, sub: "total" },
            { label: "MESSAGES", value: stats.messages, sub: "across all sessions" },
            { label: "MODELS", value: 3, sub: "distinct models used" },
            { label: "LAST ACTIVE", value: stats.last_active, sub: "hermes", dot: true },
          ].map((s) => (
            <div key={s.label} className="os-card p-3">
              <div className="section-label mb-1">{s.label}</div>
              <div className="flex items-center gap-1.5">
                {s.dot && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />}
                <span className="text-lg font-bold text-white">{s.value}</span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5 uppercase tracking-wide">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Pantheon */}
        <section>
          <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Pantheon</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                Custom AI personas — each one a bundle of instructions, a model, and a toolset. Click any card to retune or assign a task.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { key: "all", label: "ALL" },
                { key: "spades", label: "♠ SPADES" },
                { key: "hearts", label: "♥ HEARTS" },
                { key: "diamonds", label: "♦ DIAMONDS" },
                { key: "clubs", label: "♣ CLUBS" },
              ].map(f => (
                <button key={f.key} onClick={() => setSuitFilter(f.key)}
                  className="text-xs px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: suitFilter === f.key ? "rgba(212,160,23,0.18)" : "rgba(255,255,255,0.04)",
                    color: suitFilter === f.key ? "#D4A017" : "#6b7280",
                    border: `1px solid ${suitFilter === f.key ? "rgba(212,160,23,0.3)" : "transparent"}`,
                  }}
                >{f.label}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {personas.filter(p => suitFilter === "all" || p.suit === suitFilter).map((persona) => {
              const sym = SUIT_SYMBOLS[persona.suit] ?? "?";
              const bg = SUIT_BG[persona.suit] ?? "#0a1020";
              const rankLabel = persona.rank === "ace" ? "A" : persona.rank === "king" ? "K" : persona.rank === "queen" ? "Q" : persona.rank === "jack" ? "J" : persona.rank.toUpperCase();
              return (
                <div
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona)}
                  className="relative rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                  style={{ height: 280, background: bg, border: `1px solid ${persona.accentColor}30` }}
                >
                  {persona.imageUrl && (
                    <div className="absolute inset-0 w-full h-full">
                      <img 
                        src={persona.imageUrl} 
                        alt={persona.name} 
                        className="w-full h-full object-cover opacity-50 mix-blend-screen"
                        style={{ filter: "brightness(1.2) contrast(1.1)" }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                    </div>
                  )}
                  {/* Suit watermark */}
                  <div style={{ position: "absolute", bottom: -10, left: 8, fontSize: 120, color: persona.accentColor, opacity: 0.06, lineHeight: 1, userSelect: "none", fontFamily: "serif" }}>
                    {sym}
                  </div>

                  {/* Corner rank + suit */}
                  <div style={{ position: "absolute", top: 10, left: 12, color: persona.accentColor, lineHeight: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{rankLabel}</div>
                    <div style={{ fontSize: 18 }}>{sym}</div>
                  </div>

                  {/* Badge */}
                  <div className="absolute top-2 right-2">
                    <span className={`badge ${persona.synced ? "badge-teal" : "badge-amber"}`}>{persona.badge}</span>
                  </div>

                  {/* Centre glow */}
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${persona.accentColor}18 0%, transparent 70%)` }} />

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4"
                    style={{ background: `linear-gradient(0deg, ${bg}fa 0%, ${bg}cc 60%, transparent 100%)` }}>
                    <div className="font-display text-base tracking-widest mb-0.5" style={{ color: persona.accentColor }}>{persona.name}</div>
                    <div className="text-xs text-gray-400 mb-2">{persona.role}</div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: persona.modelColor }} />
                      <span className="text-xs font-mono text-gray-300">{persona.modelLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Persona */}
            <div
              onClick={() => setShowNewPersona(!showNewPersona)}
              className="rounded-xl cursor-pointer border-2 border-dashed border-white/10 hover:border-white/25 transition-colors flex flex-col items-center justify-center gap-2"
              style={{ height: 300, minWidth: 140 }}
            >
              <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
                <Plus size={18} className="text-gray-500" />
              </div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add Persona</div>
              <div className="text-xs text-gray-600 text-center px-4">Pick a template, set the job and model</div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end">
            <span className="section-label" style={{ fontSize: 9 }}>PRIVATE REPO · PORTABLE ACROSS MACHINES</span>
          </div>
        </section>

        {/* GitHub Backup Section */}
        <section className="os-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="section-label mb-1">Back up Hermes</div>
              <p className="text-sm text-gray-400 max-w-xl">
                Push to a private GitHub repo so your config and personas survive a machine swap — every edit is versioned, something starts misbehaving. Two prompts — paste each one into Hermes.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { n: "01", text: "Paste this into Hermes. She'll tell you what she needs from you (gh CLI auth, the repo name you'd like), then create a private GitHub repo and mirror ~/.hermes/ into it — config, personas, skills, memories. Sensitive runtime state stays on your machine. She'll also wire a daily cron so the backup keeps itself fresh. One-time setup." },
              { n: "02", text: "Paste this into Hermes after you've connected the repo. She'll push the latest persona YAMLs (Labyrinth, Mercury, Philosopher and any you've added), explain what each one does, and confirm they'll be summoned when you call their name in chat. Run it any time after editing a persona to capture the change." },
            ].map((step) => (
              <div key={step.n} className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-4xl font-bold mb-3" style={{ color: "rgba(255,255,255,0.08)" }}>{step.n}</div>
                <p className="text-xs text-gray-500 leading-relaxed">{step.text}</p>
                <button className="mt-3 text-xs px-3 py-1.5 rounded border border-white/15 text-gray-400 hover:text-white hover:border-white/30 transition-colors font-mono">
                  COPY INSTALL PROMPT
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>}
      
      {/* Persona Modal */}
      {selectedPersona && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onClick={() => setSelectedPersona(null)}>
          <div 
            className="os-card max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-black/85 transition-all"
            onClick={e => e.stopPropagation()}
            style={{ border: `1px solid ${selectedPersona.accentColor}60`, background: "#0a0f1d" }}
          >
            <div className="relative h-48 shrink-0 border-b" style={{ borderColor: `${selectedPersona.accentColor}30` }}>
              {selectedPersona.imageUrl && (
                <img 
                  src={selectedPersona.imageUrl} 
                  alt={selectedPersona.name} 
                  className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-70"
                  style={{ filter: "brightness(1.2) contrast(1.1)" }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/50 to-transparent" />
              <button 
                className="absolute top-4 right-4 p-1.5 bg-black/40 hover:bg-black/80 rounded-full transition-colors text-white/70 hover:text-white backdrop-blur-md"
                onClick={() => setSelectedPersona(null)}
              >
                <X size={18} />
              </button>
              
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: selectedPersona.modelColor, boxShadow: `0 0 10px ${selectedPersona.modelColor}` }} />
                  <span className="badge text-[10px] font-bold font-mono px-2 py-0.5 rounded" style={{ background: `${selectedPersona.modelColor}20`, color: selectedPersona.modelColor, border: `1px solid ${selectedPersona.modelColor}40` }}>{selectedPersona.modelLabel}</span>
                </div>
                <h3 className="font-display text-3xl tracking-widest text-white mt-2" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>{selectedPersona.name}</h3>
                <div className="text-sm font-medium uppercase tracking-wide mt-1" style={{ color: selectedPersona.accentColor }}>{selectedPersona.role}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {selectedPersona.tagline && (
                <div>
                  <div className="text-xs font-bold text-gray-500 tracking-widest mb-2">SUMMARY</div>
                  <p className="text-gray-300 text-sm leading-relaxed border-l-2 pl-3" style={{ borderColor: selectedPersona.accentColor }}>
                    {selectedPersona.tagline}
                  </p>
                </div>
              )}

              {selectedPersona.skills && selectedPersona.skills.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-500 tracking-widest mb-2">CAPABILITIES & SKILLS</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPersona.skills.map((skill: string) => (
                      <span key={skill} className="text-xs px-2.5 py-1 rounded bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedPersona.tools && selectedPersona.tools.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-500 tracking-widest mb-2">TOOLKIT</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedPersona.tools.map((t: any) => (
                      <div key={t.id} className="p-3 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="text-xs font-semibold text-gray-200 mb-1">{t.label}</div>
                        <div className="text-[11px] text-gray-400 leading-snug">{t.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/5">
                <div className="text-xs font-bold text-gray-500 tracking-widest mb-3 flex items-center justify-between">
                  <span>ASSIGN DIRECT TASK</span>
                  <span className="text-gray-600 text-[10px]">Via OpenSwarm</span>
                </div>
                <div className="relative">
                  <textarea
                    value={taskInput}
                    onChange={e => setTaskInput(e.target.value)}
                    placeholder={`Describe a task for ${selectedPersona.name}...`}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 pb-12 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors min-h-[120px] resize-y font-mono"
                  />
                  <div className="absolute bottom-3 right-3">
                    <button
                      disabled={!taskInput.trim() || assigningTask}
                      onClick={async () => {
                        setAssigningTask(true);
                        try {
                          await fetch("/api/swarm/task", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ task: `[@${selectedPersona.id}] ${taskInput}` })
                          });
                          setMessages(m => [...m, { role: "user", content: `Assigned task to ${selectedPersona.name}: ${taskInput}` }]);
                          setMessages(m => [...m, { role: "assistant", content: `Understood. I have dispatched this task to the Swarm for ${selectedPersona.name} to execute.` }]);
                          setTaskInput("");
                          setSelectedPersona(null);
                        } catch (e) {
                        } finally {
                          setAssigningTask(false);
                        }
                      }}
                      className="px-4 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-40 hover:scale-105 shadow-lg"
                      style={{ background: selectedPersona.accentColor, color: "#000", boxShadow: `0 2px 10px ${selectedPersona.accentColor}40` }}
                    >
                      {assigningTask ? "ASSIGNING..." : "ASSIGN"}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Persona Modal */}
      {showNewPersona && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setShowNewPersona(false)}>
          <div 
            className="os-card max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-black/85 transition-all"
            onClick={e => e.stopPropagation()}
            style={{ border: `1px solid ${newAccentColor}60`, background: "#0a0f1d" }}
          >
            <div className="relative p-6 shrink-0 border-b border-white/10" style={{ background: `linear-gradient(135deg, ${newAccentColor}15 0%, transparent 100%)` }}>
              <button 
                className="absolute top-4 right-4 p-1.5 bg-black/40 hover:bg-black/80 rounded-full transition-colors text-white/70 hover:text-white backdrop-blur-md"
                onClick={() => setShowNewPersona(false)}
              >
                <X size={18} />
              </button>
              
              <div className="flex items-center gap-2">
                <Plus size={20} style={{ color: newAccentColor }} />
                <h3 className="font-display text-2xl tracking-wider text-white">SUMMON NEW PERSONA</h3>
              </div>
              <p className="text-xs text-gray-400 mt-1 font-mono">Configure archetype, deck suit, and active intelligence.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Form Input: Name */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 tracking-widest block mb-1.5 uppercase font-mono">NAME / CALLSIGN</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. LABYRINTH, MERCURY" 
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors font-mono"
                />
              </div>

              {/* Form Input: Role */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 tracking-widest block mb-1.5 uppercase font-mono">OPERATIONAL ROLE</label>
                <input 
                  type="text" 
                  value={newRole} 
                  onChange={e => setNewRole(e.target.value)}
                  placeholder="e.g. Swarm Architect, Lead Negotiator" 
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Deck Suit */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 tracking-widest block mb-1.5 uppercase font-mono">DECK SUIT</label>
                  <select 
                    value={newSuit} 
                    onChange={e => setNewSuit(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors font-mono"
                  >
                    <option value="spades">♠ Spades</option>
                    <option value="hearts">♥ Hearts</option>
                    <option value="diamonds">♦ Diamonds</option>
                    <option value="clubs">♣ Clubs</option>
                  </select>
                </div>

                {/* Deck Rank */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 tracking-widest block mb-1.5 uppercase font-mono">DECK RANK</label>
                  <select 
                    value={newRank} 
                    onChange={e => setNewRank(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors font-mono"
                  >
                    <option value="ace">Ace</option>
                    <option value="king">King</option>
                    <option value="queen">Queen</option>
                    <option value="jack">Jack</option>
                    <option value="10">10</option>
                  </select>
                </div>
              </div>

              {/* Form Input: Tagline / Directive */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 tracking-widest block mb-1.5 uppercase font-mono">CORE DIRECTIVE & TAGLINE</label>
                <textarea 
                  value={newTagline} 
                  onChange={e => setNewTagline(e.target.value)}
                  placeholder="Summarize the persona's core operational priority..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors min-h-[70px] resize-y font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Active Intelligence / Model */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 tracking-widest block mb-1.5 uppercase font-mono">INTELLIGENCE MODEL</label>
                  <select 
                    value={newModelLabel} 
                    onChange={e => {
                      const model = e.target.value;
                      setNewModelLabel(model);
                      if (model === "QWEN-3.6") {
                        setNewModelColor("#8b5cf6");
                        setNewAccentColor("#8b5cf6");
                      } else if (model === "CLAUDE-3.5") {
                        setNewModelColor("#d97706");
                        setNewAccentColor("#d97706");
                      } else if (model === "GPT-4O") {
                        setNewModelColor("#10b981");
                        setNewAccentColor("#10b981");
                      } else if (model === "GEMINI-1.5") {
                        setNewModelColor("#3b82f6");
                        setNewAccentColor("#3b82f6");
                      }
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors font-mono"
                  >
                    <option value="QWEN-3.6">Qwen 3.6 (Local)</option>
                    <option value="CLAUDE-3.5">Claude 3.5 Sonnet</option>
                    <option value="GPT-4O">GPT-4o</option>
                    <option value="GEMINI-1.5">Gemini 1.5 Pro</option>
                  </select>
                </div>

                {/* Accent Color Preset */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 tracking-widest block mb-1.5 uppercase font-mono">THEME ACCENT</label>
                  <select 
                    value={newAccentColor} 
                    onChange={e => setNewAccentColor(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors font-mono"
                  >
                    <option value="#8b5cf6">Purple (Qwen)</option>
                    <option value="#d97706">Amber (Claude)</option>
                    <option value="#10b981">Emerald (GPT)</option>
                    <option value="#3b82f6">Sapphire (Gemini)</option>
                    <option value="#ec4899">Pink</option>
                    <option value="#ef4444">Crimson</option>
                  </select>
                </div>
              </div>

              {/* Form Input: Skills */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 tracking-widest block mb-1.5 uppercase font-mono">CAPABILITIES & SKILLS (COMMA-SEPARATED)</label>
                <input 
                  type="text" 
                  value={newSkills} 
                  onChange={e => setNewSkills(e.target.value)}
                  placeholder="e.g. Analytics, Strategy, Lead Generation" 
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors font-mono"
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3 shrink-0 bg-black/20">
              <button
                onClick={() => setShowNewPersona(false)}
                className="px-4 py-2 rounded text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-mono"
              >
                CANCEL
              </button>
              <button
                disabled={!newName.trim() || !newRole.trim()}
                onClick={handleCreatePersona}
                className="px-5 py-2 rounded text-xs font-bold transition-all disabled:opacity-40 hover:scale-105 shadow-lg font-mono"
                style={{ background: newAccentColor, color: "#000", boxShadow: `0 2px 10px ${newAccentColor}30` }}
              >
                SUMMON PERSONA
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      </div>
    </div>
  );
}
