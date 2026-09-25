import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { Draft, Employee, Group } from "@/lib/roster/types";
import { MONTHS, MONTH_ADJ, daysIn, isHoliday, monthKey } from "@/lib/roster/calendar";
import { GROUP_LABEL, initialState } from "@/lib/roster/defaults";
import {
  activeDraft, codeMap, compareDrafts, coverage, effGrid, frameMonths, frameStats, generate, hasMonthData, monthStats, targetOf, validate,
} from "@/lib/roster/engine";
import { useRosterState, withMonth } from "@/lib/roster/store";
import { RosterTable, CodeBadge } from "@/components/roster/RosterTable";
import { EmployeePanel, Preflight, ValidationSummary } from "@/components/roster/Panels";
import { DraftsBar } from "@/components/roster/Drafts";
import { StaffTab } from "@/components/roster/StaffTab";
import { SettingsTab } from "@/components/roster/SettingsTab";
import { ImportDialog } from "@/components/roster/ImportDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pöttyös Beosztás – laboráns műszakbeosztó" },
      { name: "description", content: "Kéthavi munkaidőkeretes műszakbeosztás tejüzemi laboránsoknak: 7/19/8/4 műszakok, SZ/B/X/HO távollétek, napi létszám-ellenőrzés." },
      { property: "og:title", content: "Pöttyös Beosztás – laboráns műszakbeosztó" },
      { property: "og:description", content: "Igazságos havi beosztás a valós kéthavi keret, előzmények és távollétek alapján." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const vowel = (s: string) => /^[aáeéiíoóöőuúüű]/i.test(s);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Index() {
  const [state, setState] = useRosterState();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(9);
  const [tab, setTab] = useState<"plan" | "staff" | "settings">("plan");
  const [empOpen, setEmpOpen] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const key = monthKey(year, month);
  const md = state.months[key];
  const draft = activeDraft(md);
  const grid = useMemo(() => effGrid(state, year, month), [state, year, month]);
  const stats = useMemo(() => monthStats(state, year, month, grid), [state, year, month, grid]);
  const frame = useMemo(() => frameStats(state, year, month, grid), [state, year, month, grid]);
  const cov = useMemo(() => coverage(state, year, month, grid), [state, year, month, grid]);
  const val = useMemo(() => validate(state, year, month, grid), [state, year, month, grid]);
  const cmp = useMemo(() => compareDrafts(state, year, month), [state, year, month]);
  const n = daysIn(year, month);
  const days = Array.from({ length: n }, (_, i) => i + 1);
  const target = targetOf(state.config, year, month);
  const fm = frameMonths(state.config);
  const fIdx = fm.findIndex(([a, b]) => a === year && b === month);
  const prevNeeded = fIdx > 0;
  const prevYM = prevNeeded ? fm[fIdx - 1] : undefined;
  const prevOk = !!prevYM && hasMonthData(state, prevYM[0], prevYM[1]);
  const leaveOk = Object.values(md?.absences ?? {}).some((r) => Object.keys(r).length > 0);
  const frameTarget = fm.reduce((a, [y, m]) => a + targetOf(state.config, y, m), 0);
  const missing = Object.values(cov).reduce((a, row) => a + Object.values(row).reduce((b, c) => b + Math.max(0, c.req - c.count), 0), 0);
  const adj = MONTH_ADJ[month] ?? "";
  const prevAdj = prevYM ? MONTH_ADJ[prevYM[1]] ?? "" : "";
  const warnText = `${vowel(adj) ? "Az" : "A"} ${adj} beosztás elkészíthető, de a kéthavi munkaidőkeret és az igazságosság nem számítható pontosan ${prevAdj} adatok nélkül.`;

  const runGenerate = () => {
    setState((s) => {
      const cur = s.months[key];
      const cnt = (cur?.drafts ?? []).filter((d) => d.name.startsWith("TERVEZET")).length;
      const d = generate(s, year, month, Date.now() % 100000, `TERVEZET ${cnt + 1}`);
      return withMonth(s, key, (m) => ({ ...m, drafts: [...m.drafts, d], activeId: d.id }));
    });
    setTab("plan");
  };

  const setCell = (id: string, d: number, code: string | null) =>
    setState((s) => {
      const cm = codeMap(s.config);
      const isWorkCode = !!code && cm[code]?.category === "work";
      return withMonth(s, key, (m) => {
        const absences = { ...m.absences, [id]: { ...(m.absences[id] ?? {}) } };
        const absRow = absences[id]!;
        delete absRow[d];
        if (code && !isWorkCode) absRow[d] = code;
        let drafts = m.drafts, activeId = m.activeId;
        if (!activeId && isWorkCode) {
          const nd: Draft = { id: crypto.randomUUID(), name: "Kézi tervezet", createdAt: Date.now(), cells: {}, why: {} };
          drafts = [...drafts, nd]; activeId = nd.id;
        }
        drafts = drafts.map((dr) => {
          if (dr.id !== activeId) return dr;
          const row = { ...(dr.cells[id] ?? {}) };
          delete row[d];
          if (isWorkCode && code) row[d] = code;
          const why = { ...dr.why };
          delete why[`${id}-${d}`];
          return { ...dr, cells: { ...dr.cells, [id]: row }, why };
        });
        return { ...m, absences, drafts, activeId };
      });
    });

  const setAbsence = (id: string, ds: number[], code: string | null) =>
    setState((s) => withMonth(s, key, (m) => {
      const row = { ...(m.absences[id] ?? {}) };
      for (const d of ds) { if (code) row[d] = code; else delete row[d]; }
      return { ...m, absences: { ...m.absences, [id]: row } };
    }));

  const updateEmp = (id: string, patch: Partial<Employee>) =>
    setState((s) => ({ ...s, employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const exportCsv = () => {
    const cm = codeMap(state.config);
    const head = ["Csoport", "Név", ...days.map(String), "Beteg órák", "Ledolg. idő", "Fiz. szab", "Összesen", "N", "É", "Szo", "V", "Maradó szabi", "Havi többletóra", "Kéthavi többletóra"];
    const rows = [head];
    for (const e of state.employees.filter((x) => x.active)) {
      const st = stats[e.id], fr = frame[e.id];
      if (!st || !fr) continue;
      rows.push([GROUP_LABEL[e.group], e.name, ...days.map((d) => { const c = grid[e.id]?.[d]; return c && cm[c] ? c : ""; }),
        String(st.sick), String(st.worked), String(st.leave), String(st.total), String(st.day), String(st.night), String(st.sat), String(st.sun),
        String(fr.remainingLeave), String(st.balance), String(fr.twoMonthBalance)]);
    }
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `beosztas-${key}.csv`;
    a.click();
  };

  return (
    <div className="dots min-h-screen">
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary" aria-hidden>
              <span className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />)}
              </span>
            </span>
            <div>
              <h1 className="font-display text-3xl font-black tracking-tight text-foreground md:text-4xl">
                PÖTTYÖS <span className="text-primary">BEOSZTÁS</span>
              </h1>
              <p className="text-sm text-muted-foreground">Laboráns műszakbeosztás – kéthavi munkaidőkerettel, a Munka Törvénykönyve szerint.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={month} onChange={(e) => setMonth(+e.target.value)} className="pill" aria-label="Hónap">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} className="pill w-24" aria-label="Év" />
            <button onClick={runGenerate} className="pill bg-primary text-primary-foreground">Új változat</button>
            <button onClick={() => setImportOpen(true)} className="pill">Excel minta / előző hónap importálása</button>
            <button onClick={exportCsv} className="pill">Excel (CSV)</button>
            <button onClick={() => window.print()} className="pill">Nyomtatás</button>
          </div>
        </header>

        <div className="mb-4 flex gap-2 print:hidden">
          {([["plan", "Beosztás"], ["staff", "Dolgozók, távollétek"], ["settings", "Beállítások, szabályok"]] as const).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={`pill ${tab === t ? "bg-foreground text-background" : ""}`}>{l}</button>
          ))}
        </div>

        {tab === "staff" && (
          <StaffTab state={state} y={year} m={month} absences={md?.absences ?? {}} onEmp={updateEmp}
            onAdd={(g: Group) => setState((s) => ({ ...s, employees: [...s.employees, { id: crypto.randomUUID(), name: "Új dolgozó", group: g, location: "", leaveBalance: 0, pattern: "shift", active: true }] }))}
            onRemove={(id) => setState((s) => ({ ...s, employees: s.employees.filter((e) => e.id !== id), config: { ...s.config, conflicts: s.config.conflicts.filter((c) => c.a !== id && c.b !== id) } }))}
            onAbsence={setAbsence}
            onConflicts={(c) => setState((s) => ({ ...s, config: { ...s.config, conflicts: c } }))} />
        )}

        {tab === "settings" && (
          <SettingsTab state={state} onConfig={(c) => setState((s) => ({ ...s, config: c }))} onReset={() => setState(initialState())} />
        )}

        {tab === "plan" && (
          <>
            <div className="print:hidden">
              <Preflight state={state} y={year} m={month} prevOk={prevOk} prevNeeded={prevNeeded} leaveOk={leaveOk}
                onGenerate={runGenerate} label={`${adj} beosztás generálása`} warnText={warnText} />
            </div>
            <DraftsBar md={md} cmp={cmp}
              onActivate={(id) => setState((s) => withMonth(s, key, (m) => ({ ...m, activeId: id })))}
              onDelete={(id) => setState((s) => withMonth(s, key, (m) => {
                const drafts = m.drafts.filter((d) => d.id !== id);
                return { ...m, drafts, activeId: m.activeId === id ? drafts[drafts.length - 1]?.id ?? null : m.activeId };
              }))} />

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
              <Stat label="Havi keret / fő" value={`${target} óra`} />
              <Stat label="Kéthavi keret / fő" value={fIdx >= 0 ? `${frameTarget} óra` : "–"} />
              <Stat label="Ünnepnap" value={days.filter((d) => isHoliday(year, month, d)).map((d) => `${d}.`).join(" ") || "–"} />
              <Stat label="Aktív tervezet" value={draft?.name ?? "nincs"} />
              <Stat label="Lefedetlen műszak" value={String(missing)} warn={missing > 0} />
            </div>

            <h2 className="font-display mb-2 hidden text-2xl font-bold print:block">Beosztás – {year}. {MONTHS[month]}</h2>
            {!draft && <p className="mb-2 text-sm text-muted-foreground print:hidden">Még nincs beosztás erre a hónapra – a rögzített távollétek látszanak. Nyomd meg a „{cap(adj)} beosztás generálása” gombot, vagy kattints egy cellára a kézi beosztáshoz.</p>}
            <RosterTable state={state} y={year} m={month} grid={grid} draft={draft} stats={stats} frame={frame} cov={cov} issues={val.issues}
              onSet={setCell} onOpenEmp={setEmpOpen} />

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {state.config.codes.map((c) => (
                <span key={c.code} className="flex items-center gap-2"><CodeBadge code={c.code} color={c.color} />{c.name}</span>
              ))}
              <span className="flex items-center gap-2"><span className="h-5 w-5 rounded bg-weekend ring-1 ring-border" />hétvége</span>
              <span className="flex items-center gap-2"><span className="h-5 w-5 rounded bg-holiday" />ünnepnap</span>
            </div>

            <div className="print:hidden">
              <ValidationSummary sections={val.sections} />
            </div>
          </>
        )}
      </div>
      {empOpen && <EmployeePanel state={state} id={empOpen} frame={frame[empOpen]} onClose={() => setEmpOpen(null)} />}
      {importOpen && <ImportDialog state={state} onClose={() => setImportOpen(false)} onApply={(s) => { setState(s); setImportOpen(false); }} />}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="card-dot">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-bold ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
