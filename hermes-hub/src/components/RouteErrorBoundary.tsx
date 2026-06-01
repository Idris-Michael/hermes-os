import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function isChunkLoadError(err: Error | null): boolean {
  if (!err) return false;
  if (err.name === "ChunkLoadError") return true;
  // Vite + most bundlers don't always set err.name; match the message too.
  return /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(err.message);
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private reloadTimer: number | null = null;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("[RouteErrorBoundary]", error);
    // Stale hashed-chunk failures are recoverable by a single hard reload.
    if (isChunkLoadError(error)) {
      this.reloadTimer = window.setTimeout(() => window.location.reload(), 1500);
    }
  }

  componentWillUnmount(): void {
    if (this.reloadTimer !== null) window.clearTimeout(this.reloadTimer);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkErr = isChunkLoadError(error);
    return (
      <div className="flex items-center justify-center w-full min-h-[60vh] p-8 font-mono text-white">
        <div className="max-w-md w-full bg-black/40 border border-[#D4A017]/25 rounded-xl p-6 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="block w-2 h-2 rounded-full bg-[#D4A017] shadow-[0_0_8px_#D4A017]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4A017]">
              {chunkErr ? "Module Load Failed" : "Route Error"}
            </span>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed mb-2">
            {chunkErr
              ? "A module chunk failed to load. Auto-reloading…"
              : "Something broke while rendering this route."}
          </p>
          <p className="text-[11px] font-mono text-gray-500 break-words mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em] bg-[#D4A017]/12 border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017]/20 transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]/50"
          >
            Reload now
          </button>
        </div>
      </div>
    );
  }
}
