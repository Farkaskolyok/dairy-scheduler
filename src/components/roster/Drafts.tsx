import { useState } from "react";
import type { MonthData } from "@/lib/roster/types";

export interface DraftCmp { id: string; name: string; missing: number; plus: number; nightSpread: number; weekendSpread: number; warns: number }

export function DraftsBar({ md, cmp, onActivate, onDelete }: {
  md: MonthData | undefined; cmp: DraftCmp[]; onActivate: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!md?.drafts.length) return null;
  return (
    <div className="card-dot mb-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">Tervezetek:</span>
        {md.drafts.map((d) => {
          const act = d.id === md.activeId;
          return (
            <span key={d.id} className={`flex items-center gap-1 rounded-full border px-1 py-1 ${act ? "border-primary bg-accent" : ""}`}>
              <span className="px-2 text-sm font-semibold">{d.name}{act && " ●"}</span>
              {!act && <button onClick={() => onActivate(d.id)} className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">Aktiválás</button>}
              <button onClick={() => { if (confirm(`Törlöd: ${d.name}?`)) onDelete(d.id); }} className="rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-destructive" aria-label="Törlés">✕</button>
            </span>
          );
        })}
        {md.drafts.length > 1 && <button onClick={() => setOpen((v) => !v)} className="pill ml-auto text-sm">{open ? "Összehasonlítás bezárása" : "Összehasonlítás"}</button>}
      </div>
      {open && (
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="text-left">Tervezet</th><th>Lefedetlen műszak</th><th>Kéthavi többlet összesen</th><th>Éjszaka-szórás (desszert)</th><th>Hétvége-szórás (desszert)</th><th>Figyelmeztetés</th></tr>
          </thead>
          <tbody>
            {cmp.map((c) => {
              const best = (k: keyof DraftCmp) => cmp.every((o) => (o[k] as number) >= (c[k] as number));
              const cell = (k: keyof DraftCmp, suf = "") => <td className={`text-center tabular-nums ${best(k) ? "font-bold text-ok-foreground" : ""}`}>{c[k]}{suf}</td>;
              return (
                <tr key={c.id} className={`border-t ${c.id === md.activeId ? "bg-accent/50" : ""}`}>
                  <td className="py-1 font-semibold">{c.name}</td>
                  {cell("missing")}{cell("plus", " óra")}{cell("nightSpread")}{cell("weekendSpread")}{cell("warns")}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
