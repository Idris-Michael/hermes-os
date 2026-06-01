import { useState, useRef, useEffect, useCallback } from "react";
import { HF_MODELS } from "../lib/models";
import { useInterval } from "../hooks/useInterval";
import {
  Send, Trash2, Cpu, ShieldCheck, Terminal, Brain,
  Sparkles, Database, Compass, Zap, Activity, Plus, MessageSquare
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
  intent?: string;
  ts: number;
}

interface ConversationSummary {
  chat_id: string;
  title: string;
  last_message_at: number;
  message_count: number;
}

const CHAT_ID_STORAGE_KEY = "hermes:chatId";

const INTENT_METADATA: Record<string, { label: string; icon: any; color: string; desc: string; glow: string }> = {
  RENDER: { 
    label: "RENDER ENGINE", 
    icon: Sparkles, 
    color: "text-[#D4A017] border-[#D4A017]/25 bg-[#D4A017]/5", 
    glow: "border-[#D4A017]/30 shadow-[0_0_15px_rgba(212,160,23,0.12)]", 
    desc: "Compiling visual media assets" 
  },
  VISION_ANALYZE: { 
    label: "VISION SYSTEM", 
    icon: Brain, 
    color: "text-[#2dd4bf] border-[#2dd4bf]/25 bg-[#2dd4bf]/5", 
    glow: "border-[#2dd4bf]/30 shadow-[0_0_15px_rgba(45,212,191,0.12)]", 
    desc: "Analyzing image & video frames" 
  },
  ANALYTICS: { 
    label: "ANALYTICS CAPTURE", 
    icon: Activity, 
    color: "text-[#7c3aed] border-[#7c3aed]/25 bg-[#7c3aed]/5", 
    glow: "border-[#7c3aed]/30 shadow-[0_0_15px_rgba(124,58,237,0.12)]", 
    desc: "Querying Upwork & LinkedIn pipelines" 
  },
  COPYWRITE: { 
    label: "COPYWRITING CORE", 
    icon: Terminal, 
    color: "text-[#f59e0b] border-[#f59e0b]/25 bg-[#f59e0b]/5", 
    glow: "border-[#f59e0b]/30 shadow-[0_0_15px_rgba(245,158,11,0.12)]", 
    desc: "Synthesizing hooks & high-impact text" 
  },
  STATUS: { 
    label: "SYSTEM MONITOR", 
    icon: ShieldCheck, 
    color: "text-[#10b981] border-[#10b981]/25 bg-[#10b981]/5", 
    glow: "border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.12)]", 
    desc: "Auditing memory nodes & port health" 
  },
  VAULT: { 
    label: "KNOWLEDGE VAULT", 
    icon: Database, 
    color: "text-[#60a5fa] border-[#60a5fa]/25 bg-[#60a5fa]/5", 
    glow: "border-[#60a5fa]/30 shadow-[0_0_15px_rgba(96,165,250,0.12)]", 
    desc: "Parsing local markdown repositories" 
  },
  CHAT: { 
    label: "NEURAL GENERAL", 
    icon: Compass, 
    color: "text-indigo-400 border-indigo-400/25 bg-indigo-400/5", 
    glow: "border-indigo-400/30 shadow-[0_0_15px_rgba(129,140,248,0.12)]", 
    desc: "General chat reasoning pipelines" 
  },
};

const SUGGESTIONS = [
  "What is the system status?",
  "Write 3 hooks for an AI brand",
  "Check recent campaign analytics",
  "Explain my neural mapping features",
];

const INITIAL_TELEMETRY_LOGS = [
  "SYSTEM: Hermes Core initialized successfully.",
  "NETWORK: Connection established on port 8642.",
  "PIPELINE: HuggingFace endpoint handshake verified.",
  "VAULT: Detected 42 dynamic memory files.",
  "TELEMETRY: Latency stabilized at 12ms.",
  "SECURITY: Session key authenticated.",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hermes Command online. Ask me anything — render reels, check analytics, write hooks, or query the vault.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(HF_MODELS[0].id);
  const [activeIntent, setActiveIntent] = useState<string | null>(null);
  
  // Real-time dynamic states
  const [latency, setLatency] = useState(12);
  const [latencyHistory, setLatencyHistory] = useState([12, 14, 11, 13, 12, 15, 11, 13, 12, 14, 12, 13]);
  const [packets, setPackets] = useState(14204);
  const [logs, setLogs] = useState<string[]>(INITIAL_TELEMETRY_LOGS);

  const [activeChatId, setActiveChatId] = useState<string>(() => {
    if (typeof window === "undefined") return "default";
    return window.localStorage.getItem(CHAT_ID_STORAGE_KEY) ?? "default";
  });
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/conversations");
      if (!r.ok) return;
      const list = (await r.json()) as ConversationSummary[];
      setConversations(list);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(CHAT_ID_STORAGE_KEY, activeChatId); } catch { /* noop */ }
  }, [activeChatId]);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);

  // Hydrate messages when switching conversations.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/chat/history/${encodeURIComponent(activeChatId)}`);
        if (!r.ok) return;
        const { messages: rows } = (await r.json()) as {
          messages: Array<{ role: string; content: string; created_at: number }>;
        };
        if (cancelled) return;
        if (!rows.length) {
          setMessages([{
            role: "assistant",
            text: "Hermes Command online. Ask me anything — render reels, check analytics, write hooks, or query the vault.",
            ts: Date.now(),
          }]);
          return;
        }
        setMessages(rows
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", text: m.content, ts: m.created_at })));
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [activeChatId]);

  async function startNewThread() {
    try {
      const r = await fetch("/api/chat/new", { method: "POST" });
      const { chat_id } = (await r.json()) as { chat_id: string };
      setActiveChatId(chat_id);
      setActiveIntent(null);
      setMessages([{ role: "assistant", text: "New thread opened. Transmit your first directive.", ts: Date.now() }]);
      refreshConversations();
    } catch { /* noop */ }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Jitter latency and tick packets dynamically (paused when tab is hidden)
  useInterval(() => {
    const nextLat = Math.max(9, Math.min(18, Math.floor(latency + (Math.random() * 4 - 2))));
    setLatency(nextLat);
    setLatencyHistory(prev => [...prev.slice(1), nextLat]);
    setPackets(prev => prev + Math.floor(Math.random() * 3));
  }, 3000);

  const timestamp = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  async function clearChat() {
    await fetch("/api/chat/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: activeChatId }),
    });
    setMessages([{ role: "assistant", text: "Chat cleared. What's next?", ts: Date.now() }]);
    setActiveIntent(null);
    setLogs(prev => [
      ...prev,
      `[${timestamp()}] SYSTEM: Dynamic chat state reset successful.`
    ].slice(-25));
    refreshConversations();
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed, ts: Date.now() }]);
    setInput("");
    setLoading(true);

    // Append operational transmission logs
    setLogs(prev => [
      ...prev,
      `[${timestamp()}] UPLINK: Packet transmission initiated (len: ${trimmed.length}).`,
      `[${timestamp()}] CLASSIFIER: Running semantic intent parsing...`
    ].slice(-25));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, model, chat_id: activeChatId }),
      });
      const data = await res.json();

      if (data.intent) {
        setActiveIntent(data.intent);
      }

      const intentLabel = data.intent ? data.intent : "CHAT";
      const extraLogs = [
        `[${timestamp()}] DOWNLINK: Received response packet resolved successfully.`,
        `[${timestamp()}] ROUTER: Integrated intent routed to [${intentLabel}].`,
      ];
      if (data.delegated_card) {
        extraLogs.push(
          `[${timestamp()}] DELEGATE: Card ${data.delegated_card.id} → ${data.delegated_card.assignee} (${data.delegated_card.priority}).`
        );
      }
      setLogs(prev => [...prev, ...extraLogs].slice(-25));

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply || "No response.", intent: data.intent, ts: Date.now() },
      ]);
      refreshConversations();
    } catch (err) {
      setLogs(prev => [
        ...prev,
        `[${timestamp()}] ERROR: Transmission packet resolution fail.`
      ].slice(-25));

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${err instanceof Error ? err.message : String(err)}`, ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex h-full w-full bg-[#020503] text-white font-sans overflow-hidden relative">
      {/* Dynamic Cyber Brackets around the main workspace viewport */}
      <div className="absolute inset-x-4 inset-y-4 pointer-events-none z-0 border border-white/[0.015] rounded-2xl">
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#D4A017]/15 rounded-tl" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#D4A017]/15 rounded-tr" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#D4A017]/15 rounded-bl" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#D4A017]/15 rounded-br" />
      </div>

      {/* ── Conversation Rail ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/5 bg-black/40 relative z-10">
        <div className="px-3 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400 font-mono">Threads</span>
          <button
            onClick={startNewThread}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cc-press"
            style={{ background: "rgba(212,160,23,0.12)", color: "#D4A017", border: "1px solid rgba(212,160,23,0.3)" }}
            title="Start a new conversation"
          >
            <Plus size={10} /> NEW
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-[10px] text-gray-600 font-mono px-2 py-3">No prior threads.</div>
          ) : (
            conversations.map((c) => {
              const isActive = c.chat_id === activeChatId;
              return (
                <button
                  key={c.chat_id}
                  onClick={() => setActiveChatId(c.chat_id)}
                  className="w-full text-left px-2 py-2 rounded transition-colors cc-press group"
                  style={{
                    background: isActive ? "rgba(212,160,23,0.14)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isActive ? "rgba(212,160,23,0.35)" : "rgba(255,255,255,0.04)"}`,
                  }}
                >
                  <div className="flex items-start gap-1.5">
                    <MessageSquare size={10} className="mt-0.5 shrink-0" style={{ color: isActive ? "#D4A017" : "#6b7280" }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] leading-tight truncate" style={{ color: isActive ? "#fde68a" : "#d1d5db" }}>
                        {c.title || c.chat_id}
                      </div>
                      <div className="text-[9px] font-mono mt-0.5 text-gray-500">
                        {c.message_count} msg · {new Date(c.last_message_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="px-3 py-2 border-t border-white/5 text-[9px] font-mono text-gray-600 uppercase tracking-widest truncate">
          Active: {activeChatId}
        </div>
      </aside>

      {/* ── Left Column: Chat Terminal ── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/5 bg-black/25 relative z-10">
        
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/45 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#D4A017]/10 border border-[#D4A017]/30 flex items-center justify-center text-sm font-bold shadow-[0_0_15px_rgba(212,160,23,0.15)] relative overflow-hidden group">
              <Zap size={15} className="text-[#D4A017] animate-pulse" />
              <div className="absolute inset-0 bg-[#D4A017]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider font-display uppercase text-white flex items-center gap-2">
                Hermes Command
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold bg-[#D4A017]/15 text-[#D4A017] border border-[#D4A017]/25 uppercase tracking-widest">
                  TACTICAL OPERATIONAL LAYER
                </span>
              </h1>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono">
                Active Session: v4.2 · Secure Tunnel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Model Select */}
            <div className="flex items-center gap-2 cc-glass bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 cc-press">
              <Cpu size={12} className="text-[#D4A017] animate-pulse" />
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-transparent border-none text-[10px] text-gray-300 font-mono focus:outline-none cursor-pointer pr-1 uppercase tracking-wider"
                style={{ appearance: 'none', WebkitAppearance: 'none' }}
              >
                {Array.from(new Set(HF_MODELS.map((m) => m.group))).map((group) => (
                  <optgroup key={group} label={group} className="bg-[#020503] text-gray-400 font-mono">
                    {HF_MODELS.filter((m) => m.group === group).map((m) => (
                      <option key={m.id} value={m.id} className="font-mono text-xs uppercase bg-[#020503]">{m.label.toUpperCase()}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Clear Button */}
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all cc-press shrink-0 font-mono uppercase tracking-wider"
            >
              <Trash2 size={11} />
              <span>CLEAR</span>
            </button>

            {/* Status Pulse */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/10 h-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-[9px] text-[#10b981] font-mono tracking-wider">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Message Logs */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth bg-black/15 relative">
          {/* Subtle grid background overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-50" />
          
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const intentMeta = msg.intent ? INTENT_METADATA[msg.intent] : null;
            const IntentIcon = intentMeta ? intentMeta.icon : Sparkles;

            return (
              <div
                key={i}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full animate-fade-in relative z-10`}
              >
                {/* Message Intent Subheader */}
                {!isUser && msg.intent && intentMeta && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[9px] font-mono mb-2.5 tracking-widest uppercase ${intentMeta.color}`}>
                    <IntentIcon size={10} className="animate-pulse" />
                    <span>{intentMeta.label}</span>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-4 transition-all duration-300 leading-relaxed relative ${
                    isUser
                      ? "bg-gradient-to-br from-[#D4A017] via-[#C59214] to-[#A3740D] text-[#020503] font-bold border border-[#D4A017]/30 shadow-[0_4px_24px_rgba(212,160,23,0.2)] rounded-tr-none tracking-wide"
                      : `cc-glass text-[#E2E8F0] rounded-tl-none border ${intentMeta ? intentMeta.glow : "border-white/10"}`
                  }`}
                  style={{
                    boxShadow: isUser 
                      ? "0 4px 24px rgba(212,160,23,0.2)"
                      : undefined
                  }}
                >
                  {/* Subtle technical corner accents for assistant messages */}
                  {!isUser && (
                    <>
                      <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-white/20 rounded-tl-sm" />
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-white/20 rounded-br-sm" />
                    </>
                  )}
                  
                  <p className="text-sm whitespace-pre-wrap word-break tracking-wide text-gray-200">
                    {msg.text}
                  </p>
                  
                  {/* Timestamp in bubble */}
                  <div className={`mt-2 text-[8px] font-mono text-right ${isUser ? "text-[#020503]/60" : "text-gray-500"} tracking-wider`}>
                    {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Neural Loading Animation */}
          {loading && (
            <div className="flex items-start w-full animate-pulse relative z-10">
              <div className="cc-glass rounded-xl rounded-tl-none p-4 flex gap-6 items-center border border-white/10 shadow-lg">
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map((n) => (
                    <div
                      key={n}
                      className="w-2 h-2 rounded-full bg-[#D4A017] shadow-[0_0_8px_#D4A017]"
                      style={{
                        animation: "hologramPulse 1.2s ease-in-out infinite",
                        animationDelay: `${n * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-[9px] font-mono text-gray-500 tracking-widest uppercase">
                  TRANSMITTING NEURAL PACKETS...
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Dynamic Context Suggestions */}
        <div className="px-6 pt-3.5 pb-1 flex flex-wrap gap-2.5 bg-black/20 border-t border-white/5 shrink-0">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[9px] font-mono tracking-widest uppercase px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-[#D4A017]/10 hover:border-[#D4A017]/30 text-gray-400 hover:text-[#D4A017] transition-all cc-press"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-md shrink-0">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative rounded-xl border border-white/10 bg-black/40 backdrop-blur-md transition-all duration-300 focus-within:border-[#D4A017]/50 focus-within:shadow-[0_0_20px_rgba(212,160,23,0.12)] overflow-hidden">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="TRANSMIT SECURE OPERATIONAL COMMANDS…"
                rows={1}
                className="w-full resize-none bg-transparent py-3.5 px-4 text-sm text-gray-200 outline-none placeholder-gray-600 leading-relaxed font-sans max-h-32 min-h-[48px] uppercase tracking-wide"
              />
              <div className="absolute right-3.5 bottom-3 flex items-center gap-1.5 text-[8px] font-mono text-gray-600 select-none tracking-widest">
                <span>PRESS ENTER TO TRANSMIT</span>
                <span className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-bold text-gray-500">↵</span>
              </div>
            </div>

            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all cc-press ${
                loading || !input.trim()
                  ? "bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed"
                  : "bg-[#D4A017] hover:bg-[#e6ae19] text-[#020503] shadow-[0_0_20px_rgba(212,160,23,0.35)] hover:shadow-[0_0_25px_rgba(212,160,23,0.5)] border border-[#D4A017]/40"
              }`}
            >
              <Send size={14} className={loading ? "animate-ping" : ""} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-3 text-[9px] text-gray-450 uppercase tracking-widest font-mono">
            <span>Shift+Enter for newline</span>
            <span>Gateway: ANTHROPIC PIPELINE</span>
          </div>
        </div>

      </div>

      {/* ── Right Column: Telemetry & Swarm Monitor ── */}
      <div className="hidden lg:flex flex-col w-[320px] shrink-0 bg-[#020503]/90 border-l border-white/10 backdrop-blur-xl p-5 overflow-y-auto space-y-6 z-10 relative">
        {/* Sleek aesthetic boundary line */}
        <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-[#D4A017]/30 via-white/5 to-white/5 pointer-events-none" />

        {/* Title */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017] animate-pulse shadow-[0_0_8px_#D4A017]" />
            <div className="section-label text-[#D4A017] font-mono tracking-widest">TACTICAL TELEMETRY</div>
          </div>
          <h2 className="text-xl font-bold font-display uppercase tracking-wider text-white">Operator Cockpit</h2>
        </div>

        {/* Live System stats */}
        <div className="relative p-4 rounded-xl cc-glass border border-white/10 overflow-hidden shadow-lg">
          {/* Tech brackets inside the panel */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#D4A017]/40 rounded-tl-sm" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#D4A017]/40 rounded-tr-sm" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#D4A017]/40 rounded-bl-sm" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#D4A017]/40 rounded-br-sm" />

          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-gray-400 font-mono tracking-wider">NEURAL LATENCY</span>
                <span className="text-[10px] text-[#10b981] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  {latency} ms
                </span>
              </div>
              {/* Telemetry Jitter Graph */}
              <div className="h-2 bg-black/60 rounded overflow-hidden flex gap-[2px] p-[1.5px] border border-white/5">
                {latencyHistory.map((val, idx) => (
                  <div 
                    key={idx} 
                    className="flex-1 bg-[#10b981]/80 rounded-[1px] transition-all duration-300"
                    style={{ height: `${(val / 22) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="h-[1px] bg-white/5" />

            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-400 font-mono tracking-wider">SESSION PACKETS</span>
              <span className="text-[10px] text-white font-mono font-bold">{packets.toLocaleString()} tx</span>
            </div>

            <div className="h-[1px] bg-white/5" />

            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-400 font-mono tracking-wider">ENCRYPTION LEVEL</span>
              <span className="text-[9px] text-[#2dd4bf] font-mono font-bold flex items-center gap-1 bg-[#2dd4bf]/5 px-2 py-0.5 rounded border border-[#2dd4bf]/15 shadow-[0_0_8px_rgba(45,212,191,0.05)]">
                <ShieldCheck size={10} /> TLS 1.3
              </span>
            </div>
          </div>
        </div>

        {/* Intent Routing Map */}
        <div>
          <div className="section-label text-gray-500 mb-3.5 font-mono tracking-widest">INTENT PIPELINES</div>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(INTENT_METADATA).map(([key, meta]) => {
              const Icon = meta.icon;
              const isActive = activeIntent === key;
              return (
                <div 
                  key={key} 
                  onClick={() => setActiveIntent(isActive ? null : key)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer cc-press select-none ${
                    isActive 
                      ? "bg-[#D4A017]/10 border-[#D4A017] shadow-[0_0_12px_rgba(212,160,23,0.2)] text-[#D4A017]" 
                      : "bg-black/30 border-white/5 hover:border-white/15 text-gray-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon size={12} className={isActive ? "text-[#D4A017]" : "text-gray-500"} />
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#D4A017] animate-pulse shadow-[0_0_8px_#D4A017]" : "bg-white/10"}`} />
                  </div>
                  <div className="text-[9px] font-bold font-mono tracking-widest truncate">
                    {key.replace("_ANALYZE", "")}
                  </div>
                  <div className="text-[7px] text-gray-600 font-mono mt-1 leading-normal truncate uppercase tracking-wider">
                    {meta.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div>
          <div className="section-label text-gray-500 mb-2.5 font-mono tracking-widest">COMMAND MACROS</div>
          <div className="space-y-2">
            {[
              { label: "/status", action: "What is the system status?" },
              { label: "/audit_upwork", action: "Audit Upwork pipeline state" },
              { label: "/audit_linkedin", action: "Audit LinkedIn profile state" },
              { label: "/strategy", action: "Draft marketing strategy hooks" },
            ].map((shortcut) => (
              <button
                key={shortcut.label}
                onClick={() => send(shortcut.action)}
                className="w-full text-left p-2.5 rounded-lg bg-black/40 hover:bg-[#D4A017]/5 border border-white/5 hover:border-[#D4A017]/30 text-xs font-mono text-gray-400 hover:text-[#D4A017] transition-all cc-press flex items-center justify-between"
              >
                <span className="tracking-widest">{shortcut.label.toUpperCase()}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-sans font-bold text-gray-500 hover:text-[#D4A017] hover:border-[#D4A017]/30 uppercase transition-all">INVOKE</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Swarm Telemetry logs */}
        <div>
          <div className="section-label text-gray-500 mb-2.5 font-mono tracking-widest">SWARM LOGS</div>
          <div className="cc-glass rounded-lg p-3.5 font-mono text-[9px] text-[#10b981] space-y-1.5 bg-black/60 max-h-36 overflow-y-auto leading-relaxed border border-emerald-950/40 relative">
            {logs.map((log, index) => (
              <div key={index} className="truncate select-none opacity-80 hover:opacity-100 transition-opacity flex gap-1">
                <span className="text-emerald-800 font-bold shrink-0">&gt;</span>
                <span className="text-gray-400 truncate">{log}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="w-1.5 h-2.5 bg-[#10b981] animate-pulse" />
              <span className="text-gray-600 italic select-none text-[8px] tracking-widest uppercase">LISTENING ON GATEWAY_8642...</span>
            </div>
          </div>
        </div>

      </div>

      {/* Styled Hologram Anim */}
      <style>{`
        @keyframes hologramPulse {
          0%, 80%, 100% { opacity: 0.35; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.05); }
        }
        .word-break {
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
