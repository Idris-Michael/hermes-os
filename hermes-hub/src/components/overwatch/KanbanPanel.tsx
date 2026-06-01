import { useState, useEffect, useRef } from "react";
import { Plus, X, GripVertical, RefreshCw, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useKanbanBoard, useKanbanVersion } from "../../hooks/queries";

interface Card {
  id: string;
  title: string;
  assignee: string;
  priority: "high" | "medium" | "low";
}

interface KanbanData {
  columns: Record<string, Card[]>;
}

const COLUMNS = ["BACKLOG", "TO DO", "IN PROGRESS", "REVIEW", "DONE"] as const;

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-900/40 text-red-300 border border-red-700/40",
  medium: "bg-amber-900/40 text-amber-300 border border-amber-700/40",
  low: "bg-slate-800/60 text-slate-400 border border-slate-600/40",
};

const COL_ACCENT: Record<string, string> = {
  BACKLOG: "border-t-slate-500",
  "TO DO": "border-t-blue-500",
  "IN PROGRESS": "border-t-amber-500",
  REVIEW: "border-t-purple-500",
  DONE: "border-t-emerald-500",
};

function uid() {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export default function KanbanPanel() {
  const queryClient = useQueryClient();
  const { data: boardData, isLoading: boardLoading, refetch: refetchBoard } = useKanbanBoard();
  const { data: versionData } = useKanbanVersion(2000);

  const [data, setData] = useState<KanbanData>({ columns: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const dragging = useRef<{ col: string; id: string } | null>(null);
  const lastVersionRef = useRef(-1);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // Hydrate local board state from the shared cache — but only when the user
  // isn't mid-edit. boardData reference changes on every refetch even when the
  // payload is identical, and overwriting during a save causes flicker.
  const savingRef = useRef(false);
  useEffect(() => {
    if (!boardData || savingRef.current || dragging.current) return;
    const cols: Record<string, Card[]> = {};
    for (const col of COLUMNS) cols[col] = Array.isArray(boardData.columns?.[col]) ? (boardData.columns[col] as Card[]) : [];
    setData({ columns: cols });
    setLoading(false);
  }, [boardData]);

  useEffect(() => { setLoading(boardLoading); }, [boardLoading]);

  // Version poll triggers a refetch only when the server's version counter bumps.
  useEffect(() => {
    if (!versionData) return;
    if (versionData.v !== lastVersionRef.current) {
      lastVersionRef.current = versionData.v;
      if (!savingRef.current && !dragging.current) refetchBoard();
    }
  }, [versionData, refetchBoard]);

  const persist = async (next: KanbanData) => {
    setSaving(true);
    savingRef.current = true;
    try {
      await fetch("/api/kanban", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      // Write the optimistic state straight to the cache so other consumers
      // see the fresh board without forcing a refetch (the version-poll will
      // catch up within 2s anyway).
      queryClient.setQueryData(["kanban"], next);
      showToast("Saved");
    } catch {
      showToast("Save failed");
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const update = (next: KanbanData) => {
    setData(next);
    persist(next);
  };

  const addCard = (col: string) => {
    if (!newTitle.trim()) return;
    const card: Card = {
      id: uid(),
      title: newTitle.trim(),
      assignee: newAssignee.trim() || "unassigned",
      priority: newPriority,
    };
    const next: KanbanData = {
      columns: {
        ...data.columns,
        [col]: [...(data.columns[col] || []), card],
      },
    };
    update(next);
    setNewTitle("");
    setNewAssignee("");
    setNewPriority("medium");
    setAddingIn(null);
  };

  const removeCard = (col: string, id: string) => {
    const next: KanbanData = {
      columns: {
        ...data.columns,
        [col]: (data.columns[col] || []).filter((c) => c.id !== id),
      },
    };
    update(next);
  };

  const onDragStart = (col: string, id: string, e: React.DragEvent) => {
    dragging.current = { col, id };
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (targetCol: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging.current) return;
    const { col: srcCol, id } = dragging.current;
    if (srcCol === targetCol) return;
    const card = (data.columns[srcCol] || []).find((c) => c.id === id);
    if (!card) return;
    const next: KanbanData = {
      columns: {
        ...data.columns,
        [srcCol]: (data.columns[srcCol] || []).filter((c) => c.id !== id),
        [targetCol]: [...(data.columns[targetCol] || []), card],
      },
    };
    update(next);
    dragging.current = null;
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f1c2e 0%, #1a2d45 100%)" }}>
        <div className="text-slate-400 text-sm">Loading kanban…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(135deg, #0f1c2e 0%, #1a2d45 100%)" }}>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "#C9A84C", color: "#1E3A5F" }}
        >
          {toast}
        </motion.div>
      )}

      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Kanban Board</h1>
            <p className="text-slate-400 text-sm mt-1">Drag cards between columns to update status</p>
          </div>
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-slate-500 flex items-center gap-1"><Save size={12} />Saving…</span>}
            <button onClick={() => refetchBoard()} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700/50 transition-all" style={{ background: "rgba(30,58,95,0.4)" }}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const cards = data.columns[col] || [];
            return (
              <div
                key={col}
                className={`flex-shrink-0 w-64 rounded-xl border-t-2 border border-slate-700/50 flex flex-col ${COL_ACCENT[col]}`}
                style={{ background: "rgba(30,58,95,0.35)", minHeight: 400 }}
                onDrop={(e) => onDrop(col, e)}
                onDragOver={onDragOver}
              >
                <div className="flex items-center justify-between px-3 py-3 border-b border-slate-700/30">
                  <span className="text-xs font-bold text-slate-300 tracking-wider">{col}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-500">{cards.length}</span>
                </div>

                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  <AnimatePresence>
                    {cards.map((card) => (
                      <motion.div
                        key={card.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable
                        onDragStart={(e) => onDragStart(col, card.id, e as unknown as React.DragEvent)}
                        className="group rounded-lg p-3 border border-slate-600/30 cursor-grab active:cursor-grabbing hover:border-amber-500/30 transition-all"
                        style={{ background: "rgba(15,28,46,0.7)" }}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical size={12} className="text-slate-600 mt-0.5 shrink-0 group-hover:text-slate-400 transition-colors" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white leading-snug">{card.title}</p>
                            <p className="text-xs text-slate-500 mt-1 truncate">{card.assignee}</p>
                          </div>
                          <button
                            onClick={() => removeCard(col, card.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="mt-2 ml-5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[card.priority] || PRIORITY_BADGE.medium}`}>
                            {card.priority}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {addingIn === col ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-lg p-3 border border-amber-500/30 space-y-2"
                      style={{ background: "rgba(15,28,46,0.8)" }}
                    >
                      <input
                        autoFocus
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addCard(col); if (e.key === "Escape") setAddingIn(null); }}
                        placeholder="Card title…"
                        className="w-full bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none border-b border-slate-600/50 pb-1"
                      />
                      <input
                        type="text"
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        placeholder="Assignee (agent slug)…"
                        className="w-full bg-transparent text-xs text-slate-400 placeholder-slate-600 focus:outline-none border-b border-slate-600/30 pb-1"
                      />
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as "high" | "medium" | "low")}
                        className="w-full bg-slate-800 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none border border-slate-600/40"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => addCard(col)}
                          className="flex-1 py-1 rounded text-xs font-semibold transition-colors"
                          style={{ background: "#C9A84C", color: "#1E3A5F" }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setAddingIn(null)}
                          className="px-3 py-1 rounded text-xs text-slate-400 hover:text-white border border-slate-600/40 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => { setAddingIn(col); setNewTitle(""); setNewAssignee(""); setNewPriority("medium"); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all border border-dashed border-slate-700/50 hover:border-slate-500/50"
                    >
                      <Plus size={12} />
                      Add card
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
