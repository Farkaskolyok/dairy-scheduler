import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  GROUP_LABEL, daysIn, generate, isHoliday, monthTarget,
  type Employee, type Group,
} from "@/lib/scheduler";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pötty Beosztás – laboráns műszakbeosztó" },
      { name: "description", content: "Igazságos havi műszakbeosztás tejüzemi laboránsoknak, Mt. szabályok és munkaidőkeret szerint." },
      { property: "og:title", content: "Pötty Beosztás – laboráns műszakbeosztó" },
      { property: "og:description", content: "Éjszaka, hétvége, ünnepnap igazságos elosztása egy kattintással." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const DEFAULT: Employee[] = [
  ...["Anna", "Éva"].map((n, i) => ({ id: `t${i}`, name: n, group: "tej" as Group, leave: [] })),
  ...["Kriszta", "Tünde", "Zsófi", "Márta", "Ildikó", "Petra", "Gábor"].map((n, i) => ({
    id: `k${i}`, name: n, group: "kesz" as Group, leave: [],
  })),
  ...["Nóra", "Judit", "Balázs"].map((n, i) => ({ id: `b${i}`, name: n, group: "baci" as Group, leave: [] })),
];
const MONTHS = ["január","február","március","április","május","június","július","augusztus","szeptember","október","november","december"];
const DOW = ["V", "H", "K", "Sz", "Cs", "P", "Sz"];
const GROUPS: Group[] = ["tej", "kesz", "baci"];

function Index() {
  const [emps, setEmps] = useState<Employee[]>(DEFAULT);
  const [conf, setConf] = useState("Kriszta+Tünde");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(9);
  const [seed, setSeed] = useState(1);
  const [tab, setTab] = useState<"plan" | "staff">("plan");

  useEffect(() => {
    const s = localStorage.getItem("potty-beosztas");
    if (s) try { const p = JSON.parse(s); setEmps(p.emps); setConf(p.conf); } catch { /* */ }
  }, []);
  useEffect(() => { localStorage.setItem("potty-beosztas", JSON.stringify({ emps, conf })); }, [emps, conf]);

  const conflicts = conf.split(/[;,\n]/).map((p) => p.split("+")).filter((p) => p.length === 2) as [string, string][];
  const res = useMemo(() => generate(emps, year, month, conflicts, seed), [emps, year, month, conf, seed]);
  const n = daysIn(year, month);
  const days = Array.from({ length: n }, (_, i) => i + 1);
  const target = monthTarget(year, month);

  const update = (id: string, patch: Partial<Employee>) =>
    setEmps((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const exportCsv = () => {
    const rows = [["Csoport", "Név", ...days.map(String), "Óra", "Keret", "Túlóra"]];
    for (const e of emps) {
      const st = res.stats[e.id];
      rows.push([GROUP_LABEL[e.group], e.name, ...days.map((d) => {
        const c = res.grid[e.id][d]; return c ? (c.kind === "N" ? "N" : c.kind === "E" ? "É" : "SZ") : "";
      }), String(st.hours), String(target), String(Math.max(0, st.hours - target))]);
    }
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `beosztas-${year}-${month + 1}.csv`;
    a.click();
  };

  return (
    <div className="dots min-h-screen">
      <div className="mx-auto max-w-[1500px] px-4 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              {["bg-primary", "bg-secondary", "bg-accent"].map((c) => (
                <span key={c} className={`h-4 w-4 rounded-full ${c}`} />
              ))}
            </div>
            <h1 className="font-display mt-2 text-4xl font-bold text-foreground md:text-5xl">Pötty Beosztás</h1>
            <p className="text-muted-foreground">Laboráns műszakbeosztás – igazságosan, a Munka Törvénykönyve szerint.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={month} onChange={(e) => setMonth(+e.target.value)} className="pill">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} className="pill w-24" />
            <button onClick={() => setSeed((s) => s + 1)} className="pill bg-primary text-primary-foreground">Új változat</button>
            <button onClick={exportCsv} className="pill">Excel (CSV)</button>
            <button onClick={() => window.print()} className="pill">Nyomtatás</button>
          </div>
        </header>

        <div className="mb-4 flex gap-2 print:hidden">
          {(["plan", "staff"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pill ${tab === t ? "bg-foreground text-background" : ""}`}>
              {t === "plan" ? "Beosztás" : "Dolgozók, szabadság"}
            </button>
          ))}
        </div>

        {tab === "staff" ? (
          <div className="grid gap-4 md:grid-cols-3">
            {GROUPS.map((g) => (
              <section key={g} className="card-dot">
                <h2 className="font-display mb-3 text-xl font-bold">{GROUP_LABEL[g]}</h2>
                {emps.filter((e) => e.group === g).map((e) => (
                  <div key={e.id} className="mb-3 rounded-2xl bg-muted p-3">
                    <div className="flex gap-2">
                      <input value={e.name} onChange={(x) => update(e.id, { name: x.target.value })} className="pill flex-1" />
                      <button onClick={() => setEmps((es) => es.filter((z) => z.id !== e.id))} className="pill">✕</button>
                    </div>
                    <label className="mt-2 block text-xs text-muted-foreground">Szabadság napjai ({MONTHS[month]}), pl. 5,6,7</label>
                    <input
                      defaultValue={e.leave.join(",")}
                      onBlur={(x) => update(e.id, { leave: x.target.value.split(/[,\s]+/).map(Number).filter((v) => v > 0) })}
                      className="pill mt-1 w-full" />
                  </div>
                ))}
                <button onClick={() => setEmps((es) => [...es, { id: crypto.randomUUID(), name: "Új dolgozó", group: g, leave: [] }])}
                  className="pill bg-secondary text-secondary-foreground">+ Dolgozó</button>
              </section>
            ))}
            <section className="card-dot md:col-span-3">
              <h2 className="font-display mb-2 text-xl font-bold">Nem dolgozhatnak együtt</h2>
              <input value={conf} onChange={(e) => setConf(e.target.value)} className="pill w-full" />
              <p className="mt-2 text-sm text-muted-foreground">Formátum: Név+Név; több pár pontosvesszővel.</p>
            </section>
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-4 print:hidden">
              <Stat label="Havi keret / fő" value={`${target} óra`} />
              <Stat label="2 havi keret / fő" value={`${target + monthTarget(month === 11 ? year + 1 : year, (month + 1) % 12)} óra`} />
              <Stat label="Ünnepnap" value={days.filter((d) => isHoliday(year, month, d)).map((d) => `${d}.`).join(" ") || "–"} />
              <Stat label="Lefedetlen műszak" value={String(res.gaps.reduce((a, g) => a + g.missing, 0))} warn={res.gaps.length > 0} />
            </div>

            <h2 className="font-display mb-2 hidden text-2xl font-bold print:block">Beosztás – {year}. {MONTHS[month]}</h2>
            <div className="card-dot overflow-x-auto p-0">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card p-2 text-left">Név</th>
                    {days.map((d) => {
                      const dow = new Date(year, month, d).getDay();
                      const off = dow === 0 || dow === 6 || isHoliday(year, month, d);
                      return (
                        <th key={d} className={`p-1 text-center text-xs ${off ? "text-primary" : "text-muted-foreground"}`}>
                          <div className="font-bold">{d}</div><div>{DOW[dow]}</div>
                        </th>
                      );
                    })}
                    <th className="p-2">Óra</th><th className="p-2">Túl</th><th className="p-2">Éj</th><th className="p-2">Hv</th><th className="p-2">Ün</th>
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((g) => (
                    <GroupRows key={g} g={g} emps={emps.filter((e) => e.group === g)} days={days} res={res} target={target} year={year} month={month} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Legend cls="shift-n" t="N" label="Nappal (07–19)" />
              <Legend cls="shift-e" t="É" label="Éjszaka (19–07)" />
              <Legend cls="shift-sz" t="SZ" label="Szabadság (8 óra)" />
            </div>

            {res.gaps.length > 0 && (
              <div className="card-dot mt-4 border-destructive">
                <h3 className="font-bold text-destructive">Hiányzó emberek</h3>
                <ul className="text-sm">
                  {res.gaps.map((g, i) => (
                    <li key={i}>{g.day}. – {GROUP_LABEL[g.group]} {g.kind === "N" ? "nappal" : "éjszaka"}: {g.missing} fő</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card-dot mt-4 text-sm text-muted-foreground print:hidden">
              <b className="text-foreground">Figyelembe vett szabályok:</b> max. 12 órás műszak, legalább 11 óra pihenő (éjszaka után másnap nincs nappal),
              legfeljebb 3 egymást követő munkanap (szükség esetén 5), 2 havi munkaidőkeret (munkanap × 8 óra), szabadság 8 órával számolva,
              éjszakák, hétvégék és ünnepnapok kiegyenlített elosztása, összeférhetetlen párok külön műszakban. A keret feletti órák túlóraként jelennek meg.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GroupRows({ g, emps, days, res, target, year, month }: {
  g: Group; emps: Employee[]; days: number[]; res: ReturnType<typeof generate>; target: number; year: number; month: number;
}) {
  return (
    <>
      <tr><td colSpan={days.length + 6} className="font-display bg-muted px-2 py-1 font-bold">{GROUP_LABEL[g]}</td></tr>
      {emps.map((e) => {
        const st = res.stats[e.id];
        const over = st.hours - target;
        return (
          <tr key={e.id}>
            <td className="sticky left-0 z-10 bg-card p-2 font-semibold whitespace-nowrap">{e.name}</td>
            {days.map((d) => {
              const c = res.grid[e.id][d];
              const dow = new Date(year, month, d).getDay();
              const off = dow === 0 || dow === 6 || isHoliday(year, month, d);
              return (
                <td key={d} className={`p-0.5 text-center ${off ? "bg-muted/60" : ""}`}>
                  {c && (
                    <span className={`shift ${c.kind === "N" ? "shift-n" : c.kind === "E" ? "shift-e" : "shift-sz"}`} title={`${c.hours} óra`}>
                      {c.kind === "E" ? "É" : c.kind === "SZ" ? "SZ" : "N"}
                    </span>
                  )}
                </td>
              );
            })}
            <td className="p-2 text-center font-bold">{st.hours}</td>
            <td className={`p-2 text-center ${over > 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}>{over > 0 ? `+${over}` : over}</td>
            <td className="p-2 text-center">{st.nights}</td>
            <td className="p-2 text-center">{st.weekends}</td>
            <td className="p-2 text-center">{st.holidays}</td>
          </tr>
        );
      })}
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="card-dot">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
function Legend({ cls, t, label }: { cls: string; t: string; label: string }) {
  return <span className="flex items-center gap-2"><span className={`shift ${cls}`}>{t}</span>{label}</span>;
}
