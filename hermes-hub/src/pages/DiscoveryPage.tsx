import { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder, FileText, BookOpen, Search, Sparkles, Save,
  ChevronRight, RefreshCw, Database, Zap,
  Globe, AlertCircle, CheckCircle, ArrowUpRight, Loader2
} from "lucide-react";
import WebGLBackground from "../components/WebGLBackground";
import ToolButton from "../components/primitives/ToolButton";
import SectionLabel from "../components/primitives/SectionLabel";
import { GOLD, EMERALD, VIOLET, surface } from "../styles/tokens";

interface VaultEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
}

interface NLMNotebook {
  id: string;
  title: string;
  source_count?: number;
  created?: string;
  updated?: string;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-md">
      <div className="w-3 h-3 rounded-sm bg-white/[0.05]" />
      <div className="h-3 flex-1 rounded bg-gradient-to-r from-white/[0.04] via-white/[0.07] to-white/[0.04] animate-pulse" />
    </div>
  );
}

// ─── Vault Browser ────────────────────────────────────────────────────────────

function VaultBrowser() {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPath = useCallback(async (p: string) => {
    setLoading(true);
    setFileContent(null);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/discovery/vault?path=${encodeURIComponent(p)}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.type === "file") {
          setFileContent(json.data.content ?? "");
        } else {
          setEntries(Array.isArray(json.data.entries) ? json.data.entries : []);
        }
        setCurrentPath(p);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/discovery/vault/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data);
        setFileContent(null);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { loadPath(""); }, [loadPath]);

  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-px bg-white/[0.04] rounded-xl overflow-hidden" style={surface}>
      {/* Rail */}
      <aside className="bg-black/30 flex flex-col min-h-[520px]">
        <header className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
          <SectionLabel accent={EMERALD}>Vault Tree</SectionLabel>
          <span className="text-[9px] font-mono text-gray-600">{entries.length} entries</span>
        </header>

        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="search vault…"
              className="w-full bg-black/40 border border-white/[0.08] rounded-md pl-8 pr-2 py-1.5 text-[11px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#D4A017]/40 focus:ring-1 focus:ring-[#D4A017]/30 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading && entries.length === 0 ? (
            <>
              <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
            </>
          ) : entries.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <div className="text-[11px] font-mono text-gray-500">Vault root empty</div>
              <div className="text-[9px] font-mono text-gray-600 mt-1">Add notes to <span className="text-[#10b981]">Desktop/Sandbox</span></div>
            </div>
          ) : (
            entries.map((entry) => {
              const isDir = entry.type === "dir";
              return (
                <button
                  key={entry.path}
                  onClick={() => loadPath(entry.path)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors duration-150 hover:bg-white/[0.05] focus:outline-none focus-visible:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-[#D4A017]/40"
                >
                  {isDir
                    ? <Folder size={12} className="text-[#10b981] flex-shrink-0" />
                    : <FileText size={12} className="text-gray-500 flex-shrink-0" />}
                  <span className={`text-[11px] font-mono truncate ${isDir ? "text-gray-200 font-semibold" : "text-gray-400"}`}>
                    {entry.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Viewer */}
      <section className="bg-black/15 flex flex-col min-h-[520px]">
        <header className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between gap-3">
          <nav className="flex items-center gap-1 flex-wrap text-[10px] font-mono" aria-label="Breadcrumb">
            <button onClick={() => loadPath("")} className="text-gray-500 hover:text-white transition-colors uppercase tracking-wider focus:outline-none focus-visible:text-white">
              vault
            </button>
            {pathParts.map((part, i) => {
              const subPath = pathParts.slice(0, i + 1).join("/");
              const isLast = i === pathParts.length - 1;
              return (
                <span key={subPath} className="flex items-center gap-1">
                  <ChevronRight size={9} className="text-gray-700" />
                  <button
                    onClick={() => loadPath(subPath)}
                    className={`transition-colors ${isLast ? "text-[#D4A017]" : "text-gray-500 hover:text-white"}`}
                  >
                    {part}
                  </button>
                </span>
              );
            })}
          </nav>
          {loading && <Loader2 size={11} className="animate-spin text-gray-500" />}
        </header>

        <div className="flex-1 overflow-auto">
          {searchResults.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {searchResults.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => loadPath(r.file)}
                    className="w-full text-left px-5 py-3 hover:bg-white/[0.03] focus:outline-none focus-visible:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
                      <span className="text-[#10b981]">{r.file}</span>
                      <span className="text-gray-600">:</span>
                      <span className="text-gray-500">{r.line}</span>
                    </div>
                    <div className="text-[11px] font-mono text-gray-300 leading-relaxed line-clamp-2">{r.content}</div>
                  </button>
                </li>
              ))}
            </ul>
          ) : fileContent !== null ? (
            <pre className="text-[12px] font-mono text-gray-200 leading-relaxed whitespace-pre-wrap m-0 px-6 py-5 max-w-[78ch]">{fileContent}</pre>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <Folder size={22} className="text-gray-700" />
              <div className="text-[11px] font-mono text-gray-500">Select a file or search the vault</div>
              <div className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{entries.length} entries available</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Research Scratchpad ──────────────────────────────────────────────────────

function Scratchpad() {
  const [notes, setNotes] = useState("");
  const [analyseText, setAnalyseText] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveNotes = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/discovery/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: notes }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const analyse = async () => {
    if (!analyseText.trim()) return;
    setAnalysing(true);
    setAnalysisResult("");
    try {
      const res = await fetch("/api/discovery/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: analyseText }),
      });
      const json = await res.json();
      if (json.success) setAnalysisResult(json.data);
    } finally {
      setAnalysing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-px bg-white/[0.04] rounded-xl overflow-hidden" style={surface}>
      {/* Compose */}
      <div className="bg-black/30 p-5 flex flex-col gap-3 min-h-[520px]">
        <div className="flex items-center justify-between">
          <SectionLabel accent={EMERALD}>Notes → Vault</SectionLabel>
          <span className="text-[9px] font-mono text-gray-600">Research/</span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Capture research notes. Saved to Obsidian Vault / Research /"
          className="flex-1 bg-black/40 border border-white/[0.08] rounded-lg p-3 text-[12px] font-mono text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-[#D4A017]/40 focus:ring-1 focus:ring-[#D4A017]/30 transition-colors leading-relaxed min-h-[280px]"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-mono text-gray-600">{notes.length} chars</span>
          <ToolButton
            onClick={saveNotes}
            loading={saving}
            disabled={!notes.trim()}
            variant={saved ? "secondary" : "primary"}
            icon={saved ? <CheckCircle size={11} className="text-emerald-400" /> : <Save size={11} />}
          >
            {saving ? "Saving" : saved ? "Saved" : "Save to Vault"}
          </ToolButton>
        </div>
      </div>

      {/* Analyse */}
      <div className="bg-black/15 p-5 flex flex-col gap-3 min-h-[520px]">
        <div className="flex items-center justify-between">
          <SectionLabel accent={GOLD}>Analyse (Claude)</SectionLabel>
          <span className="text-[9px] font-mono text-gray-600">summarise · extract</span>
        </div>
        <textarea
          value={analyseText}
          onChange={(e) => setAnalyseText(e.target.value)}
          placeholder="Paste content to summarise and extract key insights."
          rows={5}
          className="bg-black/40 border border-white/[0.08] rounded-lg p-3 text-[12px] font-mono text-gray-200 placeholder-gray-600 resize-vertical focus:outline-none focus:border-[#D4A017]/40 focus:ring-1 focus:ring-[#D4A017]/30 transition-colors leading-relaxed"
        />
        <ToolButton
          onClick={analyse}
          loading={analysing}
          disabled={!analyseText.trim()}
          variant="primary"
          icon={<Sparkles size={11} />}
        >
          {analysing ? "Analysing" : "Analyse"}
        </ToolButton>
        {analysisResult && (
          <div className="bg-black/40 border border-white/[0.07] rounded-lg p-4 text-[12px] font-mono text-gray-200 leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-auto">
            {analysisResult}
          </div>
        )}
        {!analysisResult && !analysing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-8 text-center border border-dashed border-white/[0.06] rounded-lg">
            <Sparkles size={18} className="text-gray-700" />
            <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Result will appear here</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NotebookLM Panel ─────────────────────────────────────────────────────────

function NotebookLMPanel() {
  const [notebooks, setNotebooks] = useState<NLMNotebook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NLMNotebook | null>(null);
  const didLoad = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery/notebooks");
      const json = await res.json();
      if (json.success) {
        setNotebooks(json.notebooks);
      } else {
        setError(json.error || "Failed to load");
      }
    } catch {
      setError("Server unreachable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!didLoad.current) { didLoad.current = true; load(); }
  }, [load]);

  return (
    <div className="rounded-xl overflow-hidden" style={surface}>
      <header className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SectionLabel accent={VIOLET}>NotebookLM</SectionLabel>
          <span className="text-[9px] font-mono text-gray-600">{notebooks.length} notebook{notebooks.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex items-center gap-2">
          <ToolButton onClick={load} loading={loading} icon={<RefreshCw size={11} />}>
            Refresh
          </ToolButton>
          <a
            href="https://notebooklm.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em] bg-white/[0.03] border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]/50 transition-colors"
          >
            <ArrowUpRight size={11} /> Open
          </a>
        </div>
      </header>

      {error && (
        <div className="px-5 py-2.5 border-b border-red-500/15 bg-red-500/[0.06] flex items-center gap-2 text-[11px] font-mono text-red-300">
          <AlertCircle size={11} />
          <span className="flex-1">{error}</span>
          <code className="bg-black/40 px-1.5 py-0.5 rounded text-[10px] text-red-200">notebooklm login</code>
        </div>
      )}

      <div className="p-3 min-h-[440px]">
        {loading && !notebooks.length ? (
          <div className="space-y-1.5">
            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
        ) : notebooks.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <BookOpen size={28} className="text-gray-700" />
            <div className="text-[11px] font-mono text-gray-500">No notebooks synced</div>
            <div className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">
              Run <code className="bg-black/40 px-1.5 py-0.5 rounded text-[10px] text-gray-400">notebooklm login</code>, then refresh
            </div>
          </div>
        ) : (
          <ul className="space-y-1">
            {notebooks.map((nb) => {
              const isSelected = selected?.id === nb.id;
              return (
                <li key={nb.id}>
                  <button
                    onClick={() => setSelected(isSelected ? null : nb)}
                    className="w-full text-left px-3.5 py-3 rounded-md border bg-black/20 hover:bg-black/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]/50"
                    style={{
                      borderColor: isSelected ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.05)",
                      background: isSelected ? "rgba(168,85,247,0.06)" : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BookOpen size={12} className="flex-shrink-0" style={{ color: isSelected ? VIOLET : "#6b7280" }} />
                        <span className="text-[12px] font-mono font-semibold text-gray-200 truncate">{nb.title}</span>
                      </div>
                      {nb.source_count !== undefined && (
                        <span className="text-[10px] font-mono text-gray-500 flex-shrink-0 tabular-nums">
                          {nb.source_count} <span className="text-gray-700">src</span>
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-white/[0.05] flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <span className="text-[9px] font-mono text-gray-600">id <span className="text-gray-400 break-all">{nb.id}</span></span>
                        {nb.updated && (
                          <span className="text-[9px] font-mono text-gray-600">updated <span className="text-gray-400">{new Date(nb.updated).toLocaleDateString()}</span></span>
                        )}
                        <a
                          href={`https://notebooklm.google.com/notebook/${nb.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-auto inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest text-[#a855f7] hover:text-white transition-colors"
                        >
                          <Globe size={9} /> open notebook
                        </a>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ["Vault", "Scratchpad", "NotebookLM"] as const;
type Tab = (typeof TABS)[number];

const TAB_META: Record<Tab, { icon: React.ReactNode; subtitle: string }> = {
  Vault:      { icon: <Folder size={11} />,   subtitle: "Browse · search · read" },
  Scratchpad: { icon: <Save size={11} />,     subtitle: "Capture · analyse" },
  NotebookLM: { icon: <BookOpen size={11} />, subtitle: "Synced workspaces" },
};

export default function DiscoveryPage() {
  const [tab, setTab] = useState<Tab>("Vault");
  const lastSync = useRef(Date.now()).current;

  return (
    <div className="relative min-h-screen flex flex-col w-full text-white overflow-hidden bg-[#020503]">
      <WebGLBackground showModel={false} />

      {/* Cyber bracket corners (atmospheric, low opacity) */}
      <div className="absolute inset-x-6 inset-y-4 pointer-events-none z-0 border border-white/[0.015] rounded-2xl">
        <div className="absolute top-0 left-0 w-5 h-5 border-t border-l border-[#D4A017]/15" />
        <div className="absolute top-0 right-0 w-5 h-5 border-t border-r border-[#D4A017]/15" />
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-[#D4A017]/15" />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-[#D4A017]/15" />
      </div>

      <div className="relative z-10 flex flex-col w-full h-full bg-black/30 backdrop-blur-sm overflow-y-auto">
        <div className="px-6 lg:px-10 py-6 max-w-[1280px] mx-auto w-full flex flex-col gap-6">

          {/* Header */}
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1.5 relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-[22px] font-semibold tracking-tight text-white m-0 leading-none">Discovery</h1>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-[#D4A017] bg-[#D4A017]/10 border border-[#D4A017]/25">
                    Hub
                  </span>
                </div>
                <p className="text-[10px] font-mono text-gray-500 mt-1.5 uppercase tracking-[0.14em]">
                  Vault · Scratchpad · NotebookLM
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[10px] font-mono">
              <span className="text-gray-600 uppercase tracking-widest">Vault root</span>
              <code className="text-emerald-400/80 bg-black/30 border border-white/[0.05] px-2 py-1 rounded">Desktop / Sandbox</code>
              <span className="text-gray-700">·</span>
              <span className="text-gray-500 inline-flex items-center gap-1.5">
                <Zap size={10} className="text-emerald-400" />
                last sync {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </header>

          {/* Tabs */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Workspace</SectionLabel>
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {TABS.map((t) => {
                const meta = TAB_META[t];
                const active = tab === t;
                return (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t)}
                    className={`group inline-flex items-center gap-2 pl-3 pr-3.5 py-2 rounded-md border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]/50 ${
                      active
                        ? "bg-[rgba(212,160,23,0.08)] border-[rgba(212,160,23,0.3)] text-[#D4A017]"
                        : "bg-white/[0.02] border-white/[0.07] text-gray-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {meta.icon}
                      <span className="text-[11px] font-mono font-bold uppercase tracking-[0.14em]">{t}</span>
                    </span>
                    <span className={`hidden md:inline text-[9px] font-mono tracking-wider ${active ? "text-[#D4A017]/60" : "text-gray-600"}`}>
                      {meta.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel */}
          <main className="pb-10" role="tabpanel">
            {tab === "Vault"      && <VaultBrowser />}
            {tab === "Scratchpad" && <Scratchpad />}
            {tab === "NotebookLM" && <NotebookLMPanel />}
          </main>

        </div>
      </div>
    </div>
  );
}
