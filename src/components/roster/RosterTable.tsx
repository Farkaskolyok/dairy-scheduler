import { useMemo, useState } from "react";
import type { AppState, Draft, Grid } from "@/lib/roster/types";
import { DOW, daysIn, dowOf, isHoliday, nextMonth, prevMonth } from "@/lib/roster/calendar";
import { COV_ROWS, checkCell, codeMap, makeLookup, type CovCell, type FrameInfo, type MStats } from "@/lib/roster/engine";
import { GROUPS, GROUP_LABEL } from "@/lib/roster/defaults";

const CTX_BEFORE = 3, CTX_AFTER = 3;

interface Props {
  state: AppState; y: number; m: number; grid: Grid; draft: Draft | null;
  stats: Record<string, MStats>; frame: Record<string, FrameInfo>;
  cov: Record<string, Record<number, CovCell>>; issues: Set<string>;
  onSet: (id: string, d: number, code: string | null) => void;
  onOpenEmp: (id: string) => void;
}

export function CodeBadge({ code, color, bad }: { code: string; color: string; bad?: boolean }) {
  return <span className={`shift-code code-${color} ${bad ? "ring-2 ring-destructive ring-offset-1" : ""}`}>{code}</span>;
}

export function RosterTable({ state, y, m, grid, draft, stats, frame, cov, issues, onSet, onOpenEmp }: Props) {
  const cm = useMemo(() => codeMap(state.config), [state.config]);
  const n = daysIn(y, m);
  const [py, pm] = prevMonth(y, m), [ny, nm] = nextMonth(y, m);
  const pn = daysIn(py, pm);
  const look = useMemo(() => makeLookup(state, y, m, grid), [state, y, m, grid]);
  const cols = [
    ...Array.from({ length: CTX_BEFORE }, (_, i) => ({ d: i - CTX_BEFORE + 1, y: py, m: pm, label: pn - CTX_BEFORE + 1 + i, ctx: true })),
    ...Array.from({ length: n }, (_, i) => ({ d: i + 1, y, m, label: i + 1, ctx: false })),
    ...Array.from({ length: CTX_AFTER }, (_, i) => ({ d: n + 1 + i, y: ny, m: nm, label: i + 1, ctx: true })),
  ];
  const [menu, setMenu] = useState<{ id: string; d: number; x: number; y: number } | null>(null);
  const [pop, setPop] = useState<{ row: string; d: number; x: number; y: number } | null>(null);
  const emps = state.employees.filter((e) => e.active);
  const colBg = (c: (typeof cols)[number]) => {
    if (isHoliday(c.y, c.m, c.label)) return "bg-holiday/70";
    const dow = dowOf(c.y, c.m, c.label);
    return dow === 0 || dow === 6 ? "bg-weekend" : "";
  };
  const statCols = ["Beteg", "Ledolg.", "Fiz.sz.", "N", "É", "Szo", "V", "Ün", "Maradó szabi"];
  const sticky3 = "sticky z-10 bg-card";

  return (
    <div className="card-dot relative overflow-x-auto p-0">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-[210px] bg-card p-2 text-left">Név</th>
            {cols.map((c) => (
              <th key={`${c.m}-${c.label}`} className={`min-w-[38px] p-1 text-center text-xs ${colBg(c)} ${c.ctx ? "opacity-40" : ""}`}>
                <div className="font-bold">{c.label}</div>
                <div className="text-muted-foreground">{DOW[dowOf(c.y, c.m, c.label)]}</div>
              </th>
            ))}
            {statCols.map((s) => <th key={s} className="px-2 text-xs font-semibold text-muted-foreground">{s}</th>)}
            <th className={`${sticky3} right-[128px] w-16 border-l px-2 text-xs`}>Összesen</th>
            <th className={`${sticky3} right-16 w-16 px-2 text-xs`}>Havi +</th>
            <th className={`${sticky3} right-0 w-16 px-2 text-xs`}>Kéthavi +</th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => {
            const ge = emps.filter((e) => e.group === g);
            if (!ge.length) return null;
            return [
              <tr key={g}><td colSpan={cols.length + statCols.length + 4} className="bg-muted px-2 py-1 text-xs font-bold uppercase tracking-wide">{GROUP_LABEL[g]}</td></tr>,
              ...ge.map((e) => {
                const st = stats[e.id], fr = frame[e.id];
                if (!st || !fr) return null;
                return (
                  <tr key={e.id} className="hover:bg-accent/40">
                    <td className="sticky left-0 z-10 bg-card p-1.5">
                      <button onClick={() => onOpenEmp(e.id)} className="text-left font-semibold hover:text-primary">
                        {e.name}
                        {e.pattern === "fixed8" && <span className="ml-1 text-[10px] text-muted-foreground">fix 8h</span>}
                      </button>
                    </td>
                    {cols.map((c) => {
                      const code = look(e.id, c.d);
                      const def = code ? cm[code] : undefined;
                      return (
                        <td key={c.d} className={`p-0.5 text-center ${colBg(c)} ${c.ctx ? "opacity-40" : ""}`}>
                          {c.ctx ? (
                            code ? <CodeBadge code={code} color={def?.color ?? "other"} /> : null
                          ) : (
                            <button
                              className="flex h-7 w-full min-w-[34px] items-center justify-center rounded-md hover:bg-accent print:pointer-events-none"
                              onClick={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); setMenu({ id: e.id, d: c.d, x: r.left, y: r.bottom }); }}
                              aria-label={`${e.name} ${c.d}. nap`}
                            >
                              {code && <CodeBadge code={code} color={def?.color ?? "other"} bad={issues.has(`${e.id}-${c.d}`)} />}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    {[st.sick, st.worked, st.leave, st.day, st.night, st.sat, st.sun, st.hol, fr.remainingLeave].map((v, i) => (
                      <td key={i} className="px-2 text-center tabular-nums text-muted-foreground">{v}</td>
                    ))}
                    <td className={`${sticky3} right-[128px] border-l px-2 text-center font-bold tabular-nums`}>{st.total}</td>
                    <Bal v={st.balance} cls={`${sticky3} right-16`} />
                    <Bal v={fr.twoMonthBalance} cls={`${sticky3} right-0`} />
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
        <tfoot>
          <tr><td colSpan={cols.length + statCols.length + 4} className="bg-muted px-2 py-1 text-xs font-bold uppercase tracking-wide">Napi létszám-ellenőrzés</td></tr>
          {COV_ROWS.map((row) => (
            <tr key={row.id}>
              <td className="sticky left-0 z-10 bg-card p-1.5 text-xs font-semibold">{row.label}</td>
              {cols.map((c) => {
                if (c.ctx) return <td key={c.d} className="opacity-40" />;
                const cc = cov[row.id]?.[c.d];
                if (!cc) return <td key={c.d} />;
                const cls = cc.count < cc.req ? "bg-bad text-bad-foreground" : cc.count > cc.req ? "bg-warn text-warn-foreground" : cc.req === 0 ? "text-muted-foreground" : "bg-ok text-ok-foreground";
                return (
                  <td key={c.d} className="p-0.5 text-center">
                    <button className={`h-6 w-full rounded-md text-xs font-bold ${cls}`} title={`Szükséges: ${cc.req}`}
                      onClick={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); setPop({ row: row.id, d: c.d, x: r.left, y: r.bottom }); }}>
                      {cc.count}
                    </button>
                  </td>
                );
              })}
              <td colSpan={statCols.length + 3} />
            </tr>
          ))}
        </tfoot>
      </table>

      {menu && (
        <CellMenu state={state} y={y} m={m} grid={grid} draft={draft} at={menu} onClose={() => setMenu(null)}
          onPick={(code) => { onSet(menu.id, menu.d, code); setMenu(null); }} />
      )}
      {pop && (() => {
        const cc = cov[pop.row]?.[pop.d];
        const row = COV_ROWS.find((r) => r.id === pop.row);
        return (
          <Floating x={pop.x} y={pop.y} onClose={() => setPop(null)}>
            <div className="text-xs font-bold">{row?.label} – {pop.d}.</div>
            <div className="mb-1 text-xs text-muted-foreground">Beosztva {cc?.count ?? 0} / szükséges {cc?.req ?? 0}</div>
            {cc?.names.length ? <ul className="text-sm">{cc.names.map((x) => <li key={x}>• {x}</li>)}</ul> : <div className="text-sm">Senki</div>}
          </Floating>
        );
      })()}
    </div>
  );
}

function Bal({ v, cls }: { v: number; cls: string }) {
  return <td className={`${cls} px-2 text-center font-bold tabular-nums ${v > 0 ? "text-destructive" : v < 0 ? "text-muted-foreground" : ""}`}>{v > 0 ? `+${v}` : v}</td>;
}

function Floating({ x, y, onClose, children }: { x: number; y: number; onClose: () => void; children: React.ReactNode }) {
  const left = typeof window !== "undefined" ? Math.min(x, window.innerWidth - 320) : x;
  const top = typeof window !== "undefined" ? Math.min(y + 4, window.innerHeight - 420) : y;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="card-dot fixed z-50 max-h-[420px] w-[300px] overflow-y-auto p-3" style={{ left, top }}>{children}</div>
    </>
  );
}

function CellMenu({ state, y, m, grid, draft, at, onClose, onPick }: {
  state: AppState; y: number; m: number; grid: Grid; draft: Draft | null;
  at: { id: string; d: number; x: number; y: number }; onClose: () => void; onPick: (code: string | null) => void;
}) {
  const emp = state.employees.find((e) => e.id === at.id);
  const cur = grid[at.id]?.[at.d];
  const why = draft?.why[`${at.id}-${at.d}`];
  const [showWhy, setShowWhy] = useState(false);
  const labelOf = (c: { code: string; name: string; category: string }) =>
    c.code === "7" ? "07:00" : c.code === "19" ? "19:00" : c.category === "work" ? `${c.code} óra` : c.code;
  return (
    <Floating x={at.x} y={at.y} onClose={onClose}>
      <div className="mb-2 text-xs font-bold">{emp?.name} – {m + 1}.{String(at.d).padStart(2, "0")}.</div>
      {why && cur && (
        <div className="mb-2">
          <button className="text-xs font-semibold text-primary underline" onClick={() => setShowWhy((v) => !v)}>Miért ő?</button>
          {showWhy && (
            <div className="mt-1 rounded-lg bg-accent p-2 text-xs">
              <b>{emp?.name}</b> került beosztásra, mert:
              <ul className="mt-1 list-disc pl-4">{why.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      <div className="space-y-1">
        {state.config.codes.map((c) => {
          const warn = checkCell(state, y, m, grid, at.id, at.d, c.code);
          return (
            <button key={c.code} onClick={() => onPick(c.code)}
              className={`flex w-full items-start gap-2 rounded-lg p-1.5 text-left hover:bg-accent ${cur === c.code ? "bg-muted" : ""}`}>
              <CodeBadge code={c.code} color={c.color} />
              <span className="flex-1 text-sm">
                <span className="font-semibold">{labelOf(c)}</span> <span className="text-muted-foreground">{c.name}</span>
                {warn.map((w) => <span key={w} className={`block text-xs ${w.startsWith("Nem") ? "text-destructive" : "text-warn-foreground"}`}>⚠ {w}</span>)}
              </span>
            </button>
          );
        })}
        <button onClick={() => onPick(null)} className="w-full rounded-lg p-1.5 text-left text-sm font-semibold hover:bg-accent">✕ Törlés</button>
      </div>
    </Floating>
  );
}
