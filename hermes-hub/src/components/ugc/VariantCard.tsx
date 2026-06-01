import { Play } from "lucide-react";
import type { UGCVariant } from "../../types/ugc";

const HOOK_COLOR: Record<string, string> = {
  transformation: "#00FF88",
  contrarian: "#f59e0b",
  "curiosity-gap": "#06b6d4",
  "social-proof": "#7C3AED",
  "direct-offer": "#ec4899",
};

interface VariantCardProps {
  variant: UGCVariant;
  selected: boolean;
  onToggle: (id: string) => void;
}

export default function VariantCard({ variant, selected, onToggle }: VariantCardProps) {
  const color = HOOK_COLOR[variant.hook_style] ?? "#00FF88";

  return (
    <div
      onClick={() => onToggle(variant.id)}
      className="relative cursor-pointer rounded-xl overflow-hidden border transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: selected ? color : "rgba(255,255,255,0.08)",
        boxShadow: selected ? `0 0 0 2px ${color}40` : "none",
      }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-black/40 flex items-center justify-center">
        {variant.thumbnail_path ? (
          <img
            src={`/api/renders/${encodeURIComponent(variant.thumbnail_path)}`}
            alt={variant.hook_style}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-30">
            <Play size={28} />
            <span className="text-xs">No preview</span>
          </div>
        )}
        {variant.render_path && (
          <a
            href={`/api/renders/${encodeURIComponent(variant.render_path)}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50"
          >
            <Play size={32} className="text-white" />
          </a>
        )}
        {/* Hook style badge */}
        <span
          className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
        >
          {variant.hook_style}
        </span>
        {/* Checkbox */}
        <div
          className="absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
          style={{ borderColor: selected ? color : "rgba(255,255,255,0.3)", background: selected ? color : "transparent" }}
        >
          {selected && <span className="text-black text-xs font-bold">✓</span>}
        </div>
      </div>

      {/* Meta */}
      <div className="p-3 space-y-1">
        <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{variant.hook_text}</p>
        <p className="text-white/40 text-[11px] line-clamp-2">{variant.caption}</p>
      </div>
    </div>
  );
}
