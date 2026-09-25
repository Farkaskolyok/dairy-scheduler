import { useState } from "react";
import type { AppState, Employee, Group, Pattern } from "@/lib/roster/types";
import { MONTHS, daysIn } from "@/lib/roster/calendar";
import { GROUPS, GROUP_LABEL } from "@/lib/roster/defaults";
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
  const byCode: Record<string, number[]> = {};
  for (const [d, c] of Object.entries(row)) (byCode[c] ??= []).push(+d);
  return (
    <div className="mt-2">
      <div className="text-xs text-muted-foreground">Távollét – {MONTHS[m]} (pl. 5,6,7 vagy 12-16)</div>
      <div className="mt-1 flex gap-1">
        <select value={code} onChange={(x) => setCode(x.target.value)} className="pill px-2">{codes.map((c) => <option key={c}>{c}</option>)}</select>
        <input value={txt} onChange={(x) => setTxt(x.target.value)} className="pill min-w-0 flex-1" placeholder="napok" />
        <button onClick={() => { onSet(parse(), code); setTxt(""); }} className="pill bg-primary text-primary-foreground">+</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {Object.entries(byCode).map(([c, ds]) => (
          <span key={c} className="flex items-center gap-1 rounded-full bg-card px-1 py-0.5 text-xs">
            <CodeBadge code={c} color={colorOf(c)} /> {ds.sort((a, b) => a - b).join(", ")}
            <button onClick={() => onSet(ds, null)} className="px-1 text-muted-foreground hover:text-destructive" aria-label={`${c} törlése`}>✕</button>
          </span>
        ))}
      </div>
    </div>
  );
}
