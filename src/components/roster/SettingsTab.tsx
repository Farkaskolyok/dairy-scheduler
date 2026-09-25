import type { AppState, CodeCategory, CodeDef, Config, DayType, ReqRow, RuleType } from "@/lib/roster/types";
import { MONTHS, autoMonthTarget, monthKey } from "@/lib/roster/calendar";
import { COLOR_KEYS, GROUPS, GROUP_LABEL, RULE_TYPE_LABEL } from "@/lib/roster/defaults";
import { frameMonths } from "@/lib/roster/engine";
import { CodeBadge } from "./RosterTable";

const DT: Record<DayType, string> = { wd: "Hétfő–Péntek", sat: "Szombat", sun: "Vasárnap" };

export function SettingsTab({ state, onConfig, onReset }: { state: AppState; onConfig: (c: Config) => void; onReset: () => void }) {
  const cfg = state.config;
  const set = (p: Partial<Config>) => onConfig({ ...cfg, ...p });
  const setReq = (r: ReqRow, p: Partial<ReqRow>) => set({ reqs: cfg.reqs.map((x) => (x === r ? { ...x, ...p } : x)) });
  const setCode = (c: CodeDef, p: Partial<CodeDef>) => set({ codes: cfg.codes.map((x) => (x === c ? { ...x, ...p } : x)) });
  const workCodes = cfg.codes.filter((c) => c.category === "work");
  const rules: { type: RuleType; name: string; body: React.ReactNode }[] = [
    { type: "LEGAL_HARD", name: "Napi pihenőidő", body: <span>legalább <Num v={cfg.minRest} on={(v) => set({ minRest: v })} /> óra két műszak között (éjszaka után másnap nincs 07:00-s kezdés)</span> },
    { type: "LEGAL_HARD", name: "Egymást követő munkanapok", body: <span>legfeljebb <Num v={cfg.maxConsecLegal} on={(v) => set({ maxConsecLegal: v })} /> nap egymás után (egyenlőtlen beosztásnál 6 munkanap után heti pihenőnap)</span> },
    { type: "LEGAL_HARD", name: "Műszakhossz", body: <span>legfeljebb 12 óra / műszak (a kódtáblában beállítva)</span> },
    { type: "AVAILABILITY", name: "Jóváhagyott távollét", body: <span>SZ / B / X / HO napokra soha nem kerül műszak</span> },
    { type: "COMPANY_HARD", name: "Összeférhetetlen párok", body: <span>{cfg.conflicts.length} pár – a „Dolgozók” fülön szerkeszthető</span> },
    { type: "COMPANY_HARD", name: "Csoport-jogosultság", body: <span>mindenki csak a saját csoportjában osztható be</span> },
    { type: "STAFFING", name: "Napi létszámigény", body: <span>lásd a lenti táblázatot</span> },
    { type: "PREFERENCE", name: "Egymást követő műszakok (céges preferencia)", body: (
      <span><label className="mr-2"><input type="checkbox" checked={cfg.preferMaxConsec.enabled} onChange={(e) => set({ preferMaxConsec: { ...cfg.preferMaxConsec, enabled: e.target.checked } })} /> bekapcsolva</label>
        lehetőleg max. <Num v={cfg.preferMaxConsec.value} on={(v) => set({ preferMaxConsec: { ...cfg.preferMaxConsec, value: v } })} /> egymás után – csak pontozást befolyásol, nem tiltás</span>
    ) },
    { type: "FAIRNESS", name: "Munkaidőkeret-egyenleg", body: <span>a keret feletti óra túlóraként jelenik meg; a generátor a kerethez legközelebb eső dolgozót részesíti előnyben</span> },
    { type: "FAIRNESS", name: "Éjszaka / szombat / vasárnap / ünnepnap", body: <span>kéthavi (előzményekkel számolt) kiegyenlítés</span> },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card-dot">
        <h2 className="font-display mb-3 text-xl font-bold">Munkaidőkeret</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>Munkaidőkeret kezdete<input type="date" value={cfg.frameStart} onChange={(e) => set({ frameStart: e.target.value })} className="pill mt-1 w-full" /></label>
          <label>Munkaidőkeret vége<input type="date" value={cfg.frameEnd} onChange={(e) => set({ frameEnd: e.target.value })} className="pill mt-1 w-full" /></label>
        </div>
        <h3 className="mt-4 mb-2 font-bold">Havi keret (óra)</h3>
        <table className="w-full text-sm">
          <tbody>
            {frameMonths(cfg).map(([y, m]) => {
              const k = monthKey(y, m), auto = autoMonthTarget(y, m);
              return (
                <tr key={k} className="border-t">
                  <td className="py-1">{y}. {MONTHS[m]}</td>
                  <td><input type="number" value={cfg.targets[k] ?? auto} onChange={(e) => set({ targets: { ...cfg.targets, [k]: +e.target.value } })} className="pill w-24" /></td>
                  <td className="text-xs text-muted-foreground">általános munkarend: {auto} óra</td>
                </tr>
              );
            })}
            <tr className="border-t font-bold"><td className="py-1">Kéthavi keret</td><td colSpan={2}>{frameMonths(cfg).reduce((a, [y, m]) => a + (cfg.targets[monthKey(y, m)] ?? autoMonthTarget(y, m)), 0)} óra</td></tr>
          </tbody>
        </table>
      </section>

      <section className="card-dot">
        <h2 className="font-display mb-3 text-xl font-bold">Szabályok</h2>
        <ul className="space-y-2 text-sm">
          {rules.map((r) => (
            <li key={r.name} className="rounded-xl bg-muted p-2">
              <span className="mr-2 rounded-full bg-card px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{RULE_TYPE_LABEL[r.type]}</span>
              <b>{r.name}:</b> {r.body}
            </li>
          ))}
        </ul>
      </section>

      <section className="card-dot lg:col-span-2">
        <h2 className="font-display mb-3 text-xl font-bold">Napi létszámigény <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{RULE_TYPE_LABEL.STAFFING}</span></h2>
        <div className="grid gap-4 md:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g}>
              <h3 className="mb-1 font-bold">{GROUP_LABEL[g]}</h3>
              <table className="w-full text-sm">
                <tbody>
                  {cfg.reqs.filter((r) => r.group === g).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1">{DT[r.dayType]}</td>
                      <td>{r.kind === "D" ? "nappal" : "éjszaka"}</td>
                      <td><input type="number" min={0} value={r.count} onChange={(e) => setReq(r, { count: Math.max(0, +e.target.value) })} className="pill w-16 px-2" /> fő</td>
                      <td>
                        <select value={r.code} onChange={(e) => setReq(r, { code: e.target.value })} className="pill px-2">
                          {workCodes.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="mt-1 text-xs text-primary underline" onClick={() => set({ reqs: [...cfg.reqs, { group: g, dayType: "wd", kind: "E", count: 0, code: "19" }] })}>+ éjszakai sor</button>
            </div>
          ))}
        </div>
      </section>

      <section className="card-dot overflow-x-auto lg:col-span-2">
        <h2 className="font-display mb-3 text-xl font-bold">Kódtábla (műszak- és státuszkódok)</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="text-left">Kód</th><th className="text-left">Név</th><th>Típus</th><th>Óra</th><th>Kezdés</th><th>Munkaidő</th><th>Elszámolt</th><th>Tiltja a beosztást</th><th>Szín</th><th className="text-left">Leírás</th></tr>
          </thead>
          <tbody>
            {cfg.codes.map((c) => (
              <tr key={c.code} className="border-t">
                <td className="py-1"><CodeBadge code={c.code} color={c.color} /></td>
                <td><input value={c.name} onChange={(e) => setCode(c, { name: e.target.value })} className="pill w-44 px-2" /></td>
                <td>
                  <select value={c.category} onChange={(e) => setCode(c, { category: e.target.value as CodeCategory })} className="pill px-2">
                    <option value="work">munka</option><option value="leave">fizetett szabadság</option><option value="sick">beteg</option><option value="other">egyéb</option>
                  </select>
                </td>
                <td><input type="number" value={c.hours} onChange={(e) => setCode(c, { hours: +e.target.value })} className="pill w-16 px-2" /></td>
                <td>{c.category === "work" ? <input type="number" value={c.start} onChange={(e) => setCode(c, { start: +e.target.value })} className="pill w-16 px-2" /> : "–"}</td>
                <td className="text-center"><input type="checkbox" checked={c.countsWork} onChange={(e) => setCode(c, { countsWork: e.target.checked })} /></td>
                <td className="text-center"><input type="checkbox" checked={c.countsAccounted} onChange={(e) => setCode(c, { countsAccounted: e.target.checked })} /></td>
                <td className="text-center">{c.category === "work" ? "–" : "IGEN"}</td>
                <td>
                  <select value={c.color} onChange={(e) => setCode(c, { color: e.target.value })} className="pill px-2">
                    {COLOR_KEYS.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </td>
                <td className="text-xs text-muted-foreground">{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="mt-2 text-xs text-primary underline" onClick={() => {
          const code = prompt("Új státuszkód (pl. T):")?.trim().toUpperCase();
          if (code && !cfg.codes.some((c) => c.code === code)) set({ codes: [...cfg.codes, { code, name: code, category: "other", hours: 0, start: 0, countsWork: false, countsAccounted: false, blocks: true, color: "other", description: "Egyéni kód" }] });
        }}>+ új státuszkód</button>
      </section>

      <section className="card-dot lg:col-span-2">
        <button onClick={() => { if (confirm("Minden adat visszaáll a valós szeptember–októberi alapállapotra. Folytatod?")) onReset(); }} className="pill text-destructive">Alapállapot visszaállítása</button>
      </section>
    </div>
  );
}

function Num({ v, on }: { v: number; on: (v: number) => void }) {
  return <input type="number" value={v} onChange={(e) => on(+e.target.value)} className="pill mx-1 w-16 px-2 py-0.5" />;
}
