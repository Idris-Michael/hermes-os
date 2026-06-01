import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ToolButtonVariant = "primary" | "secondary" | "ghost";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ToolButtonVariant;
  icon?: ReactNode;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}

const variantStyle: Record<ToolButtonVariant, string> = {
  primary:
    "bg-[rgba(212,160,23,0.12)] border border-[rgba(212,160,23,0.32)] text-[#D4A017] hover:bg-[rgba(212,160,23,0.18)] hover:border-[rgba(212,160,23,0.5)] active:scale-[0.98]",
  secondary:
    "bg-white/[0.03] border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.07] hover:border-white/15 active:scale-[0.98]",
  ghost:
    "bg-transparent border border-transparent text-gray-500 hover:text-white hover:bg-white/[0.04]",
};

/**
 * Canonical interactive control across the Hermes OS hub.
 * - Active scale-down on press.
 * - Visible focus ring (gold) at 50% alpha.
 * - Loading + disabled states wired.
 */
export default function ToolButton({
  children, onClick, disabled, loading, variant = "secondary", icon, type = "button", className = "", title,
}: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em] transition-[background-color,border-color,color,transform] duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-black ${variantStyle[variant]} ${className}`}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}
