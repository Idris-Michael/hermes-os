import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

/**
 * Shared query hooks for endpoints with 2+ consumers. Migrating one-off fetches
 * into here gains nothing — only add an endpoint when a second consumer arrives.
 *
 * Refetch cadence is set per-hook based on how live the data needs to be:
 *  - profiles/skills change rarely → no interval, only stale-while-revalidate
 *  - swarm logs / kanban change constantly → short interval
 *  - constellation is huge and infrequent → long interval
 *
 * All hooks honour the global `refetchIntervalInBackground: false` default
 * (set in main.tsx), so polling pauses when the tab is hidden.
 */

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return (await r.json()) as T;
}

// ─── /api/profiles ──────────────────────────────────────────────────────────

export interface RawProfile {
  id: string;
  name: string;
  suit?: string;
  rank?: string;
  role?: string;
  tagline?: string;
  modelLabel?: string;
  modelColor?: string;
  accentColor?: string;
  skills?: unknown;
  soulFile?: string;
  soulContent?: string | null;
  [extra: string]: unknown;
}

export function useProfiles(
  options?: Omit<UseQueryOptions<RawProfile[]>, "queryKey" | "queryFn">,
): UseQueryResult<RawProfile[]> {
  return useQuery<RawProfile[]>({
    queryKey: ["profiles"],
    queryFn: () => getJson<RawProfile[]>("/api/profiles"),
    staleTime: 30_000,
    ...options,
  });
}

// ─── /api/memory ────────────────────────────────────────────────────────────

export interface MemoryGraph {
  nodes: Array<{ id: string; name: string; type: string; description: string; path: string; mtime: number }>;
  signals: Array<{ name: string; mtime: number; ago: string }>;
  stats: { total: number; stale: number; missing: number };
}

export function useMemoryGraph(): UseQueryResult<MemoryGraph> {
  return useQuery<MemoryGraph>({
    queryKey: ["memory"],
    queryFn: () => getJson<MemoryGraph>("/api/memory"),
    staleTime: 60_000,
  });
}

// ─── /api/constellation ─────────────────────────────────────────────────────

export interface ConstellationData {
  nodes: Array<{ id: string; label: string; group: string; val: number; color: string }>;
  links: Array<{ source: string; target: string; type: string; curvature?: number }>;
}

export function useConstellation(): UseQueryResult<ConstellationData> {
  return useQuery<ConstellationData>({
    queryKey: ["constellation"],
    queryFn: () => getJson<ConstellationData>("/api/constellation"),
    staleTime: 5 * 60_000,
  });
}

// ─── /api/swarm/logs ────────────────────────────────────────────────────────

export interface SwarmLogState {
  lines?: string[];
  running?: boolean;
}

export function useSwarmLogs(refetchInterval: number | false = 2500): UseQueryResult<SwarmLogState> {
  return useQuery<SwarmLogState>({
    queryKey: ["swarm-logs"],
    queryFn: () => getJson<SwarmLogState>("/api/swarm/logs"),
    refetchInterval,
    staleTime: 0,
  });
}

// ─── /api/kanban + /api/kanban/version ──────────────────────────────────────

export interface KanbanCard {
  id: string;
  title: string;
  assignee: string;
  priority: "high" | "medium" | "low";
  chatId?: string;
  intent?: string;
  createdAt?: number;
}

export interface KanbanBoard {
  columns: Record<string, KanbanCard[]>;
}

export function useKanbanVersion(refetchInterval: number | false = 2000): UseQueryResult<{ v: number }> {
  return useQuery<{ v: number }>({
    queryKey: ["kanban-version"],
    queryFn: () => getJson<{ v: number }>("/api/kanban/version"),
    refetchInterval,
    staleTime: 0,
  });
}

export function useKanbanBoard(): UseQueryResult<KanbanBoard> {
  return useQuery<KanbanBoard>({
    queryKey: ["kanban"],
    queryFn: () => getJson<KanbanBoard>("/api/kanban"),
    staleTime: 0,
  });
}
