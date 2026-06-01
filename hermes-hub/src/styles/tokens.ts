/**
 * Hermes OS shared design tokens. Derived from PRODUCT.md.
 * Use these instead of hard-coding hex anywhere in the app.
 */

export const GOLD = "#D4A017";        // primary action / strategic accent
export const EMERALD = "#10b981";     // live / connected / online state
export const VIOLET = "#a855f7";      // creative / growth surfaces
export const RED = "#ef4444";         // destructive / failure (use sparingly)

export const BG_BASE = "#020503";

export const surface = {
  background: "linear-gradient(180deg, rgba(14,14,20,0.78) 0%, rgba(8,8,14,0.82) 100%)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 32px rgba(0,0,0,0.45)",
} as const;
