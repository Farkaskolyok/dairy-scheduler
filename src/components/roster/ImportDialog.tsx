import { useState } from "react";
import type { AppState } from "@/lib/roster/types";
import { MONTHS } from "@/lib/roster/calendar";
import { GROUP_LABEL } from "@/lib/roster/defaults";
import { applyImport, parseWorkbook, type ImportSheet } from "@/lib/roster/importXlsx";

export function ImportDialog({ state, onApply, onClose }: { state: AppState; onApply: (s: AppState) => void; onClose: () => void }) {
  const [sheets, setSheets] = useState<ImportSheet[] | null>(null);
  const [err, setErr] = useState("");
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    try {
      const res = parseWorkbook(await f.arrayBuffer(), state.config.codes.map((c) => c.code));
      if (!res.length) setErr("Nem találtam felismerhető beosztás-munkalapot (név + napok fejléc).");
      setSheets(res);
    } catch (e) {
      setErr(`A fájl nem olvasható: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/20" onClick={onClose} />
      <div className="card-dot fixed left-1/2 top-10 z-50 max-h-[85vh] w-[min(760px,95vw)] -translate-x-1/2 overflow-y-auto p-5">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl font-bold">Excel minta / előző hónap importálása</h2>
          <button onClick={onClose} className="pill">✕</button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Tölts fel egy .xlsx beosztást (pl. 2026 Szeptember_Október). Minden hónap-munkalapot külön felismerek; jóváhagyás előtt semmi nem változik.</p>
        <input type="file" accept=".xlsx" onChange={(e) => onFile(e.target.files?.[0])} className="pill mt-3 w-full" />
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        {sheets?.map((s, i) => (
          <div key={s.sheet} className="mt-4 rounded-xl border p-3">
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" checked={s.include} onChange={(e) => setSheets(sheets.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
              {s.year}. {MONTHS[s.month]} <span className="text-xs font-normal text-muted-foreground">(munkalap: {s.sheet})</span>
            </label>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              <li>Felismerve: <b>{s.rows.length} dolgozó</b></li>
              <li>Felismerve: <b>{s.days} nap</b></li>
              <li>Havi keret a fájlban: <b>{s.target ?? "–"}</b></li>
              <li>Ismeretlen kód: <b className={s.unknown.length ? "text-destructive" : ""}>{s.unknown.length ? s.unknown.join(", ") : "nincs"}</b></li>
            </ul>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-primary">Dolgozók és statisztikák</summary>
              <table className="mt-2 w-full text-xs">
                <thead className="text-muted-foreground"><tr><th className="text-left">Név</th><th className="text-left">Csoport</th><th>Ledolg.</th><th>Fiz.sz.</th><th>Beteg</th><th>N</th><th>É</th><th>Havi +</th></tr></thead>
                <tbody>
                  {s.rows.map((r) => (
                    <tr key={r.name} className="border-t">
                      <td className="py-0.5">{r.name}</td>
                      <td>{r.group ? GROUP_LABEL[r.group] : "? (meglévő / Desszert)"}{r.pattern === "fixed8" ? " · fix 8h" : ""}</td>
                      {(["worked", "leave", "sick", "day", "night", "monthBal"] as const).map((k) => <td key={k} className="text-center">{r.stats[k] ?? "–"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        ))}
        {sheets && sheets.length > 0 && (
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onClose} className="pill">Mégse</button>
            <button disabled={!sheets.some((s) => s.include)} onClick={() => onApply(applyImport(state, sheets))} className="pill bg-primary text-primary-foreground disabled:opacity-50">
              Importálás jóváhagyása
            </button>
          </div>
        )}
      </div>
    </>
  );
}
