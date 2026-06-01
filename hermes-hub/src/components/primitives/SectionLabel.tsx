import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  accent?: string;
}

/**
 * Small uppercase HUD label with a coloured live-dot. Used as the heading
 * for a section, panel, or rail group across the Hermes OS hub.
 */
export default function SectionLabel({ children, accent = "#8e9bb0" }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="block w-1 h-1 rounded-full"
        style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
      />
      <span
        className="text-[9px] font-mono font-bold uppercase tracking-[0.22em]"
        style={{ color: accent }}
      >
        {children}
      </span>
    </div>
  );
}
