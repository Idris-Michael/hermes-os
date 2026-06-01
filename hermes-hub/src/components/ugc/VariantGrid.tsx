import { useState } from "react";
import VariantCard from "./VariantCard";
import ApprovalPanel from "./ApprovalPanel";
import type { UGCVariant } from "../../types/ugc";

interface VariantGridProps {
  variants: UGCVariant[];
  clientId: string;
}

export default function VariantGrid({ variants, clientId }: VariantGridProps) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 pb-24">
        {variants.map((v) => (
          <VariantCard key={v.id} variant={v} selected={selected.includes(v.id)} onToggle={toggle} />
        ))}
        {variants.length === 0 && (
          <div className="col-span-5 text-center py-16 text-white/30 text-sm">
            No variants generated yet.
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <ApprovalPanel selectedIds={selected} clientId={clientId} onClear={() => setSelected([])} />
      )}
    </div>
  );
}
