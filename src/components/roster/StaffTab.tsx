import { useState } from "react";
import type { AppState, Employee, Group, Kind, Pattern, Restriction } from "@/lib/roster/types";
import { MONTHS, daysIn } from "@/lib/roster/calendar";
import { DAY_NAMES, GROUPS, GROUP_LABEL } from "@/lib/roster/defaults";
import { CodeBadge } from "./RosterTable";

interface Props {
  state: AppState; y: number; m: number;
  absences: Record<string, Record<number, string>>;
  onEmp: (id: string, patch: Partial<Employee>) => void;
  onAdd: (g: Group) => void;
  onRemove: (id: string) => void;
  onAbsence: (id: string, days: number[], code: string | null) => void;
  onConflicts: (c: AppState["config"]["conflicts"]) => void;
}

export function StaffTab({ state, y, m, absences, onEmp, onAdd, onRemove, onAbsence, onConflicts }: Props) {
  const statusCodes = state.config.codes.filter((c) => c.category !== "work");
  const colorOf = (code: string) => state.config.codes.find((c) => c.code === code)?.color ?? "other";
  const conf = state.config.conflicts;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {GROUPS.map((g) => (
        <section key={g} className="card-dot">
          <h2 className="font-display mb-3 text-xl font-bold">{GROUP_LABEL[g]}</h2>
          {state.employees.filter((e) => e.group === g).map((e) => (
            <div key={e.id} className={`mb-3 rounded-2xl bg-muted p-3 ${e.active ? "" : "opacity-60"}`}>
              <div className="flex gap-2">
                <input value={e.name} onChange={(x) => onEmp(e.id, { name: x.target.value })} className="pill min-w-0 flex-1" aria-label="Név" />
                <button onClick={() => { if (confirm(`Törlöd: ${e.name}?`)) onRemove(e.id); }} className="pill" aria-label="Dolgozó törlése">✕</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <label>Csoport
                  <select value={e.group} onChange={(x) => onEmp(e.id, { group: x.target.value as Group })} className="pill mt-1 w-full">
                    {GROUPS.map((gg) => <option key={gg} value={gg}>{GROUP_LABEL[gg]}</option>)}
                  </select>
                </label>
                <label>Munkarend
                  <select value={e.pattern} onChange={(x) => onEmp(e.id, { pattern: x.target.value as Pattern })} className="pill mt-1 w-full">
                    <option value="shift">Műszakos (7 / 19)</option>
                    <option value="fixed8">Fix 8 órás hétköznap</option>
                  </select>
                </label>
                <label>Telephely
                  <input value={e.location} onChange={(x) => onEmp(e.id, { location: x.target.value })} className="pill mt-1 w-full" />
                </label>
                <label>Szabadságkeret (nap, keret elején)
                  <input type="number" value={e.leaveBalance} onChange={(x) => onEmp(e.id, { leaveBalance: +x.target.value })} className="pill mt-1 w-full" />
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={e.active} onChange={(x) => onEmp(e.id, { active: x.target.checked })} /> Aktív (beosztható)
              </label>
              <AbsenceEditor y={y} m={m} row={absences[e.id] ?? {}} codes={statusCodes.map((c) => c.code)} colorOf={colorOf}
                onSet={(days, code) => onAbsence(e.id, days, code)} />
              <RestrictionEditor list={e.restrictions ?? []} onChange={(restrictions) => onEmp(e.id, { restrictions })} />
            </div>
          ))}
          <button onClick={() => onAdd(g)} className="pill bg-secondary text-secondary-foreground">+ Dolgozó</button>
        </section>
      ))}
      <section className="card-dot lg:col-span-3">
        <h2 className="font-display mb-1 text-xl font-bold">Nem dolgozhatnak együtt <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">Céges kemény szabály</span></h2>
        <p className="mb-3 text-sm text-muted-foreground">A generátor ezeket a párokat soha nem teszi ugyanarra a napra, azonos (nappalos vagy éjszakás) műszakba.</p>
        {conf.map((c) => (
          <div key={c.id} className="mb-2 flex flex-wrap items-center gap-2">
            {(["a", "b"] as const).map((k) => (
              <select key={k} value={c[k]} onChange={(x) => onConflicts(conf.map((z) => (z.id === c.id ? { ...z, [k]: x.target.value } : z)))} className="pill">
                {state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            ))}
            <button onClick={() => onConflicts(conf.filter((z) => z.id !== c.id))} className="pill">✕</button>
          </div>
        ))}
        <button onClick={() => { const [a, b] = state.employees; if (a && b) onConflicts([...conf, { id: crypto.randomUUID(), a: a.id, b: b.id }]); }} className="pill bg-secondary text-secondary-foreground">+ Pár</button>
      </section>
    </div>
  );
}

function AbsenceEditor({ y, m, row, codes, colorOf, onSet }: {
  y: number; m: number; row: Record<number, string>; codes: string[]; colorOf: (c: string) => string;
  onSet: (days: number[], code: string | null) => void;
}) {
  const [code, setCode] = useState(codes[0] ?? "SZ");
  const [txt, setTxt] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const n = daysIn(y, m);
  const parse = () => {
    const out: number[] = [];
    for (const part of txt.split(/[,\s]+/)) {
      const r = part.match(/^(\d+)-(\d+)$/);
      if (r) for (let d = +r[1]!; d <= +r[2]!; d++) out.push(d);
      else if (+part > 0) out.push(+part);
    }
    return out.filter((d) => d >= 1 && d <= n);
  };
  const add = () => {
    const ds = parse();
    // csak az új napok kerülnek be – a már rögzített napok változatlanok maradnak
    const fresh = ds.filter((d) => !row[d]);
    const kept = ds.length - fresh.length;
    if (fresh.length) onSet(fresh, code);
    setNote(kept ? `${kept} nap már rögzítve volt, az nem változott (egyenként módosítható).` : "");
    setTxt("");
  };
  const days = Object.keys(row).map(Number).sort((a, b) => a - b);
  return (
    <div className="mt-2">
      <div className="text-xs text-muted-foreground">Távollét – {MONTHS[m]} (pl. 5,6,7 vagy 12-16)</div>
      <div className="mt-1 flex gap-1">
        <select value={code} onChange={(x) => setCode(x.target.value)} className="pill px-2">{codes.map((c) => <option key={c}>{c}</option>)}</select>
        <input value={txt} onChange={(x) => setTxt(x.target.value)} onKeyDown={(x) => { if (x.key === "Enter") add(); }} className="pill min-w-0 flex-1" placeholder="napok" />
        <button onClick={add} className="pill bg-primary text-primary-foreground" aria-label="Távollét hozzáadása">+</button>
      </div>
      {note && <div className="mt-1 text-xs text-warn-foreground">{note}</div>}
      <div className="mt-2 flex flex-wrap gap-1">
        {days.map((d) => {
          const c = row[d]!;
          return (
            <span key={d} className="flex items-center gap-1 rounded-full bg-card py-0.5 pl-2 pr-0.5 text-xs">
              <b className="tabular-nums">{d}.</b>
              {editing === d ? (
                <select autoFocus value={c} onChange={(x) => { onSet([d], x.target.value); setEditing(null); }} onBlur={() => setEditing(null)}
                  className="rounded-md border bg-card px-1 text-xs" aria-label={`${d}. nap kódja`}>
                  {codes.map((k) => <option key={k}>{k}</option>)}
                </select>
              ) : (
                <button onClick={() => setEditing(d)} className="flex items-center gap-0.5" aria-label={`${d}. nap módosítása`} title="Kód módosítása">
                  <CodeBadge code={c} color={colorOf(c)} /><span className="text-muted-foreground">✎</span>
                </button>
              )}
              <button onClick={() => onSet([d], null)} className="px-1 text-muted-foreground hover:text-destructive" aria-label={`${d}. nap törlése`}>✕</button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function RestrictionEditor({ list, onChange }: { list: Restriction[]; onChange: (l: Restriction[]) => void }) {
  const set = (id: string, p: Partial<Restriction>) => onChange(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const active = list.filter((r) => r.enabled).length;
  return (
    <details className="mt-2 rounded-xl bg-card p-2 text-xs" open={list.length > 0 ? undefined : false}>
      <summary className="cursor-pointer font-semibold">
        Egyéni beosztási szabályok {active ? <span className="ml-1 rounded-full bg-accent px-1.5 text-accent-foreground">{active} tiltás</span> : <span className="text-muted-foreground">(nincs)</span>}
      </summary>
      <p className="mt-1 text-muted-foreground">Állandó tiltás minden hétre – a generátor ezekre soha nem osztja be, kézi beírásnál figyelmeztet.</p>
      <div className="mt-1 space-y-1">
        {list.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-1">
            <select value={r.dow} onChange={(x) => set(r.id, { dow: +x.target.value })} className="pill px-2 py-0.5" aria-label="Nap">
              {WEEK_ORDER.map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
            </select>
            <select value={r.kind} onChange={(x) => set(r.id, { kind: x.target.value as Kind })} className="pill px-2 py-0.5" aria-label="Műszak">
              <option value="D">Nappal (07:00)</option>
              <option value="E">Éjszaka (19:00)</option>
            </select>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={r.enabled} onChange={(x) => set(r.id, { enabled: x.target.checked })} /> Tiltva
            </label>
            <button onClick={() => onChange(list.filter((z) => z.id !== r.id))} className="px-1 text-muted-foreground hover:text-destructive" aria-label="Szabály törlése">✕</button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...list, { id: crypto.randomUUID(), dow: 6, kind: "E", enabled: true }])} className="mt-1 text-primary underline">+ szabály</button>
    </details>
  );
}
