import type { AppState } from "@/lib/roster/types";
import { MONTHS } from "@/lib/roster/calendar";
import { GROUP_LABEL } from "@/lib/roster/defaults";
import { targetOf, type FrameInfo, type Level, type Section } from "@/lib/roster/engine";

const ICON: Record<Level, string> = { ok: "✓", warn: "⚠", bad: "✕" };
const LCLS: Record<Level, string> = { ok: "bg-ok text-ok-foreground", warn: "bg-warn text-warn-foreground", bad: "bg-bad text-bad-foreground" };

export function ValidationSummary({ sections }: { sections: Section[] }) {
  return (
    <div className="card-dot mt-4">
      <h3 className="font-display mb-3 text-lg font-bold">Ellenőrzés</h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((s) => (
          <details key={s.id} className="rounded-xl border p-2" open={s.level !== "ok"}>
            <summary className="flex cursor-pointer items-center gap-2 font-semibold">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${LCLS[s.level]}`}>{ICON[s.level]}</span>
              {s.title}
              <span className="ml-auto text-xs text-muted-foreground">{s.items.filter((i) => i.level !== "ok").length || ""}</span>
            </summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
              {s.items.map((i, k) => (
                <li key={k} className="flex gap-1.5">
                  <span className={i.level === "bad" ? "text-destructive" : i.level === "warn" ? "text-warn-foreground" : "text-ok-foreground"}>{ICON[i.level]}</span>
                  <span>{i.text}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

export function EmployeePanel({ state, id, frame, onClose }: { state: AppState; id: string; frame: FrameInfo | undefined; onClose: () => void }) {
  const e = state.employees.find((x) => x.id === id);
  if (!e || !frame) return null;
  const rows: [string, (s: FrameInfo["cum"]) => number][] = [
    ["Ledolgozott idő", (s) => s.worked], ["Fizetett szabadság", (s) => s.leave], ["Beteg órák", (s) => s.sick],
    ["Összesen", (s) => s.total], ["Keret", (s) => s.target], ["Nappalos műszak", (s) => s.day], ["Éjszakás műszak", (s) => s.night],
    ["Szombat", (s) => s.sat], ["Vasárnap", (s) => s.sun], ["Ünnepnap", (s) => s.hol], ["Havi többletóra", (s) => s.balance],
  ];
  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">{e.name}</h2>
            <p className="text-sm text-muted-foreground">{GROUP_LABEL[e.group]} · {e.location || "–"}{e.pattern === "fixed8" ? " · fix 8 órás" : ""}</p>
          </div>
          <button onClick={onClose} className="pill">✕</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Box label="Maradó szabadság" value={`${frame.remainingLeave} nap`} />
          <Box label="Kéthavi többletóra" value={fmt(frame.twoMonthBalance)} warn={frame.twoMonthBalance > 0} />
          <Box label="Kéthavi keret" value={`${frame.frameTarget} óra`} />
          <Box label="Várható egyenleg a keret végén" value={fmt(frame.projected)} warn={frame.projected > 0} />
        </div>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left">&nbsp;</th>
              {frame.months.map((mo) => (
                <th key={mo.key} className="px-1 text-right">{MONTHS[mo.m]}{mo.current ? " (akt.)" : ""}{!mo.hasData ? " *" : ""}</th>
              ))}
              <th className="px-1 text-right">Kéthavi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label} className="border-t">
                <td className="py-1">{label}</td>
                {frame.months.map((mo) => <td key={mo.key} className="px-1 text-right tabular-nums">{f(mo.stats)}</td>)}
                <td className="px-1 text-right font-bold tabular-nums">{label === "Havi többletóra" ? frame.twoMonthBalance : f(frame.cum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {frame.months.some((mo) => !mo.hasData) && <p className="mt-2 text-xs text-muted-foreground">* ehhez a hónaphoz még nincs beosztás</p>}
        <p className="mt-2 text-xs text-muted-foreground">A „Kéthavi” oszlop a keret elejétől a kiválasztott hónapig összesít. A várható egyenleg a keret összes hónapjával számol.</p>
      </aside>
    </>
  );
}
const fmt = (v: number) => `${v > 0 ? "+" : ""}${v} óra`;
function Box({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display text-lg font-bold ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

export function Preflight({ state, y, m, prevOk, prevNeeded, leaveOk, onGenerate, label, warnText }: {
  state: AppState; y: number; m: number; prevOk: boolean; prevNeeded: boolean; leaveOk: boolean; onGenerate: () => void; label: string; warnText: string;
}) {
  const reqOk = (["kesz", "tej", "mikro"] as const).every((g) => state.config.reqs.some((r) => r.group === g && r.count > 0));
  const confOk = state.config.conflicts.length > 0;
  const Y = ({ ok, text }: { ok: boolean; text?: string }) => (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ok ? "bg-ok text-ok-foreground" : "bg-warn text-warn-foreground"}`}>{text ?? (ok ? "IGEN" : "NEM")}</span>
  );
  return (
    <div className="card-dot mb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <h3 className="font-display mb-2 text-lg font-bold">Generálási alapadatok</h3>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            <li className="flex justify-between gap-2">Munkaidőkeret <b>{state.config.frameStart} – {state.config.frameEnd}</b></li>
            <li className="flex justify-between gap-2">Havi keret ({MONTHS[m]}) <b>{targetOf(state.config, y, m)} óra</b></li>
            <li className="flex justify-between gap-2">Előző hónap adatai betöltve {prevNeeded ? <Y ok={prevOk} /> : <Y ok text="keret 1. hónapja" />}</li>
            <li className="flex justify-between gap-2">Szabadság / távollét betöltve <Y ok={leaveOk} /></li>
            <li className="flex justify-between gap-2">Létszámigény beállítva <Y ok={reqOk} /></li>
            <li className="flex justify-between gap-2">Összeférhetetlenségi szabályok <Y ok={confOk} /></li>
          </ul>
          {prevNeeded && !prevOk && (
            <p className="mt-2 rounded-lg bg-warn p-2 text-sm text-warn-foreground">
              {warnText}
            </p>
          )}
        </div>
        <button onClick={onGenerate} className="rounded-2xl bg-primary px-6 py-4 font-display text-lg font-black uppercase tracking-wide text-primary-foreground shadow-md hover:opacity-90">
          {label}
        </button>
      </div>
    </div>
  );
}
