// @ts-nocheck -- index-heavy algorithm, types checked at API boundary
import type { AppState, CodeDef, Config, DayType, Draft, Employee, Grid, Group, Kind, MonthData } from "./types";
import { autoMonthTarget, daysIn, dowOf, isHoliday, monthKey, nextMonth, parseYM, prevMonth } from "./calendar";
import { GROUP_LABEL } from "./defaults";

export const codeMap = (cfg: Config): Record<string, CodeDef> => Object.fromEntries(cfg.codes.map((c) => [c.code, c]));
export const dayTypeOf = (dow: number): DayType => (dow === 0 ? "sun" : dow === 6 ? "sat" : "wd");
export const kindOf = (c?: CodeDef): Kind => (c && c.start >= 18 ? "E" : "D");
export const isWork = (c?: CodeDef) => !!c && c.category === "work";

export function targetOf(cfg: Config, y: number, m: number): number {
  return cfg.targets[monthKey(y, m)] ?? autoMonthTarget(y, m);
}

export function frameMonths(cfg: Config): [number, number][] {
  const [sy, sm] = parseYM(cfg.frameStart), [ey, em] = parseYM(cfg.frameEnd);
  const out: [number, number][] = [];
  let y = sy, m = sm;
  for (let i = 0; i < 24 && (y < ey || (y === ey && m <= em)); i++) {
    out.push([y, m]);
    [y, m] = nextMonth(y, m);
  }
  return out;
}
export const inFrame = (cfg: Config, y: number, m: number) => frameMonths(cfg).some(([a, b]) => a === y && b === m);

export const activeDraft = (md?: MonthData): Draft | null => md?.drafts.find((d) => d.id === md.activeId) ?? null;

export function effGrid(state: AppState, y: number, m: number, draft?: Draft | null): Grid {
  const md = state.months[monthKey(y, m)];
  const d = draft === undefined ? activeDraft(md) : draft;
  const g: Grid = {};
  for (const e of state.employees) g[e.id] = { ...(d?.cells[e.id] ?? {}), ...(md?.absences[e.id] ?? {}) };
  return g;
}

export function hasMonthData(state: AppState, y: number, m: number) {
  const md = state.months[monthKey(y, m)];
  const d = activeDraft(md);
  return !!d && Object.values(d.cells).some((r) => Object.keys(r).length > 0);
}

/** kódlekérdezés a hónaphatáron át is (előző / következő hónap) */
export function makeLookup(state: AppState, y: number, m: number, cur: Grid) {
  const n = daysIn(y, m);
  const [py, pm] = prevMonth(y, m), [ny, nm] = nextMonth(y, m);
  let pg: Grid | null = null, ng: Grid | null = null;
  return (id: string, d: number): string | undefined => {
    if (d >= 1 && d <= n) return cur[id]?.[d];
    if (d < 1) { pg ??= effGrid(state, py, pm); return pg[id]?.[daysIn(py, pm) + d]; }
    ng ??= effGrid(state, ny, nm); return ng[id]?.[d - n];
  };
}
type Look = ReturnType<typeof makeLookup>;

export function restIssue(look: Look, cm, cfg: Config, id: string, d: number, code: string): string | null {
  const c = cm[code]; if (!isWork(c)) return null;
  const s = d * 24 + c.start, e = s + c.hours;
  const p = look(id, d - 1), pc = cm[p];
  if (isWork(pc)) {
    const pe = (d - 1) * 24 + pc.start + pc.hours;
    if (s - pe < cfg.minRest) return `az előző napi (${p}) műszak után csak ${Math.max(0, s - pe)} óra pihenő marad (min. ${cfg.minRest} óra)`;
  }
  const nx = look(id, d + 1), nc = cm[nx];
  if (isWork(nc)) {
    const ns = (d + 1) * 24 + nc.start;
    if (ns - e < cfg.minRest) return `a következő napi (${nx}) műszak előtt csak ${Math.max(0, ns - e)} óra pihenő marad (min. ${cfg.minRest} óra)`;
  }
  return null;
}

export function runBefore(look: Look, cm, id: string, d: number) {
  let c = 0; for (let k = d - 1; k > d - 15 && isWork(cm[look(id, k)]); k--) c++; return c;
}
export function runAfter(look: Look, cm, id: string, d: number) {
  let c = 0; for (let k = d + 1; k < d + 15 && isWork(cm[look(id, k)]); k++) c++; return c;
}

function conflictPartner(state: AppState, grid: Grid, cm, id: string, d: number, kind: Kind): string | null {
  for (const cf of state.config.conflicts) {
    const other = cf.a === id ? cf.b : cf.b === id ? cf.a : null;
    if (!other) continue;
    const oc = cm[grid[other]?.[d]];
    if (isWork(oc) && kindOf(oc) === kind) return state.employees.find((e) => e.id === other)?.name ?? "?";
  }
  return null;
}

export function groupKinds(cfg: Config, g: Group): Set<Kind> {
  return new Set(cfg.reqs.filter((r) => r.group === g && r.count > 0).map((r) => r.kind));
}

/** Kézi szerkesztés előtti ellenőrzés: szabálysértések szöveges listája */
export function checkCell(state: AppState, y: number, m: number, grid: Grid, id: string, d: number, code: string): string[] {
  const cfg = state.config, cm = codeMap(cfg), c = cm[code];
  const emp = state.employees.find((e) => e.id === id);
  if (!c || !emp || !isWork(c)) return [];
  const out: string[] = [];
  const abs = state.months[monthKey(y, m)]?.absences[id]?.[d];
  if (abs) out.push(`Nem megfelelő: erre a napra távollét (${abs}) van rögzítve.`);
  const kind = kindOf(c);
  if (!groupKinds(cfg, emp.group).has(kind)) out.push(`Nem megfelelő: a(z) ${GROUP_LABEL[emp.group]} csoportban nincs ${kind === "E" ? "éjszakás" : "nappalos"} műszak.`);
  const tmp = { ...grid, [id]: { ...grid[id], [d]: code } };
  const look = makeLookup(state, y, m, tmp);
  const r = restIssue(look, cm, cfg, id, d, code);
  if (r) out.push(`Nem megfelelő: ${r}.`);
  const run = 1 + runBefore(look, cm, id, d) + runAfter(look, cm, id, d);
  if (run > cfg.maxConsecLegal) out.push(`Nem megfelelő: ${run} egymást követő munkanap (max. ${cfg.maxConsecLegal}).`);
  const p = conflictPartner(state, tmp, cm, id, d, kind);
  if (p) out.push(`Nem megfelelő: ${p} ugyanebben a műszakban dolgozik (összeférhetetlen pár).`);
  if (cfg.preferMaxConsec.enabled && run > cfg.preferMaxConsec.value && run <= cfg.maxConsecLegal)
    out.push(`Céges preferencia: ${run} egymást követő műszak (javasolt max. ${cfg.preferMaxConsec.value}).`);
  return out;
}

export interface MStats { sick: number; worked: number; leave: number; total: number; day: number; night: number; short: number; sat: number; sun: number; hol: number; leaveDays: number; target: number; balance: number }
const emptyStats = (target = 0): MStats => ({ sick: 0, worked: 0, leave: 0, total: 0, day: 0, night: 0, short: 0, sat: 0, sun: 0, hol: 0, leaveDays: 0, target, balance: -target });

export function monthStats(state: AppState, y: number, m: number, grid: Grid): Record<string, MStats> {
  const cm = codeMap(state.config), n = daysIn(y, m), target = targetOf(state.config, y, m);
  const out: Record<string, MStats> = {};
  for (const e of state.employees) {
    const s = emptyStats(target);
    for (let d = 1; d <= n; d++) {
      const c = cm[grid[e.id]?.[d]]; if (!c) continue;
      if (c.countsAccounted) s.total += c.hours;
      if (c.category === "work") {
        if (c.countsWork) s.worked += c.hours;
        if (kindOf(c) === "E") s.night++; else if (c.hours >= 12) s.day++; else s.short++;
        const dow = dowOf(y, m, d);
        if (dow === 6) s.sat++;
        if (dow === 0) s.sun++;
        if (isHoliday(y, m, d)) s.hol++;
      } else if (c.category === "leave") { s.leave += c.hours; s.leaveDays++; }
      else if (c.category === "sick") s.sick += c.hours;
    }
    s.balance = s.total - target;
    out[e.id] = s;
  }
  return out;
}

export interface FrameInfo {
  months: { y: number; m: number; key: string; stats: MStats; hasData: boolean; current: boolean }[];
  cum: MStats; // keret elejétől a kiválasztott hónapig
  frameTarget: number;
  twoMonthBalance: number;
  projected: number;
  remainingLeave: number;
}

export function frameStats(state: AppState, y: number, m: number, cur: Grid): Record<string, FrameInfo> {
  const cfg = state.config;
  let fm = frameMonths(cfg);
  if (!fm.some(([a, b]) => a === y && b === m)) fm = [[y, m]];
  const per = fm.map(([a, b]) => {
    const current = a === y && b === m;
    const g = current ? cur : effGrid(state, a, b);
    return { y: a, m: b, key: monthKey(a, b), current, hasData: current || hasMonthData(state, a, b), stats: monthStats(state, a, b, g) };
  });
  const idx = per.findIndex((p) => p.current);
  const frameTarget = per.reduce((a, p) => a + targetOf(cfg, p.y, p.m), 0);
  const out: Record<string, FrameInfo> = {};
  for (const e of state.employees) {
    const cum = emptyStats(0);
    let all = 0, leaveAll = 0;
    per.forEach((p, i) => {
      const s = p.stats[e.id];
      all += s.total;
      if (i <= idx) {
        for (const k of Object.keys(cum) as (keyof MStats)[]) cum[k] += s[k];
        leaveAll += s.leaveDays;
      }
    });
    cum.balance = cum.total - cum.target;
    out[e.id] = {
      months: per.map((p) => ({ y: p.y, m: p.m, key: p.key, stats: p.stats[e.id], hasData: p.hasData, current: p.current })),
      cum, frameTarget, twoMonthBalance: cum.balance, projected: all - frameTarget, remainingLeave: e.leaveBalance - leaveAll,
    };
  }
  return out;
}

export const COV_ROWS = [
  { id: "kD", label: "Nappal (TR+D)", group: "kesz" as Group, kind: "D" as Kind },
  { id: "kE", label: "Éjszaka (TR+D)", group: "kesz" as Group, kind: "E" as Kind },
  { id: "tD", label: "Tejátvétel nappal", group: "tej" as Group, kind: "D" as Kind },
  { id: "tE", label: "Tejátvétel éjszaka", group: "tej" as Group, kind: "E" as Kind },
  { id: "mD", label: "Mikro nappal", group: "mikro" as Group, kind: "D" as Kind },
  { id: "mE", label: "Mikro éjszaka", group: "mikro" as Group, kind: "E" as Kind },
];
export interface CovCell { count: number; req: number; names: string[] }

export function reqCount(cfg: Config, g: Group, dow: number, kind: Kind) {
  const dt = dayTypeOf(dow);
  return cfg.reqs.filter((r) => r.group === g && r.dayType === dt && r.kind === kind).reduce((a, r) => a + r.count, 0);
}

export function coverage(state: AppState, y: number, m: number, grid: Grid): Record<string, Record<number, CovCell>> {
  const cm = codeMap(state.config), n = daysIn(y, m), out = {};
  for (const row of COV_ROWS) {
    out[row.id] = {};
    const staff = state.employees.filter((e) => e.active && e.group === row.group && e.pattern === "shift");
    for (let d = 1; d <= n; d++) {
      const names = staff.filter((e) => { const c = cm[grid[e.id]?.[d]]; return isWork(c) && kindOf(c) === row.kind; }).map((e) => e.name);
      out[row.id][d] = { count: names.length, req: reqCount(state.config, row.group, dowOf(y, m, d), row.kind), names };
    }
  }
  return out;
}

/* ---------------- Generátor ---------------- */

export function generate(state: AppState, y: number, m: number, seed: number, name: string): Draft {
  let r = (seed * 7919 + 12345) % 233280;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const cfg = state.config, cm = codeMap(cfg), n = daysIn(y, m), key = monthKey(y, m);
  const abs = state.months[key]?.absences ?? {};
  const emps = state.employees.filter((e) => e.active);
  const cells: Grid = {}, why: Record<string, string[]> = {}, cur: Grid = {};
  for (const e of state.employees) { cells[e.id] = {}; cur[e.id] = { ...(abs[e.id] ?? {}) }; }
  const look = makeLookup(state, y, m, cur);

  // előzmény: a keret korábbi hónapjai (pl. szeptember októberhez)
  const fm = frameMonths(cfg);
  const idx = fm.findIndex(([a, b]) => a === y && b === m);
  const priorMonths = idx > 0 ? fm.slice(0, idx) : [];
  let priorTarget = 0;
  const prior: Record<string, MStats> = {};
  for (const e of state.employees) prior[e.id] = emptyStats(0);
  for (const [a, b] of priorMonths) {
    priorTarget += targetOf(cfg, a, b);
    const st = monthStats(state, a, b, effGrid(state, a, b));
    for (const e of state.employees) for (const k of Object.keys(st[e.id]) as (keyof MStats)[]) prior[e.id][k] += st[e.id][k];
  }
  const target = targetOf(cfg, y, m);
  const plan: Record<string, { acc: number; night: number; sat: number; sun: number; hol: number }> = {};
  for (const e of state.employees) {
    let acc = 0;
    for (const c of Object.values(cur[e.id])) { const cd = cm[c]; if (cd?.countsAccounted) acc += cd.hours; }
    plan[e.id] = { acc, night: 0, sat: 0, sun: 0, hol: 0 };
  }
  const need = (id: string) => priorTarget + target - (prior[id].total + plan[id].acc);
  const N = (id: string) => prior[id].night + plan[id].night;
  const SA = (id: string) => prior[id].sat + plan[id].sat;
  const SU = (id: string) => prior[id].sun + plan[id].sun;
  const HO = (id: string) => prior[id].hol + plan[id].hol;
  const assign = (id: string, d: number, code: string, reasons: string[]) => {
    const c = cm[code];
    cur[id][d] = code; cells[id][d] = code; why[`${id}-${d}`] = reasons;
    plan[id].acc += c.countsAccounted ? c.hours : 0;
    if (kindOf(c) === "E") plan[id].night++;
    const dow = dowOf(y, m, d);
    if (dow === 6) plan[id].sat++;
    if (dow === 0) plan[id].sun++;
    if (isHoliday(y, m, d)) plan[id].hol++;
  };

  // 1) fix 8 órás munkarend (hétköznap, nem ünnep)
  const fixedCode = cfg.codes.find((c) => c.category === "work" && c.hours === 8)?.code;
  if (fixedCode) for (const e of emps.filter((e) => e.pattern === "fixed8")) {
    for (let d = 1; d <= n; d++) {
      const dow = dowOf(y, m, d);
      if (dow === 0 || dow === 6 || isHoliday(y, m, d) || cur[e.id][d]) continue;
      if (restIssue(look, cm, cfg, e.id, d, fixedCode)) continue;
      assign(e.id, d, fixedCode, ["fix 8 órás munkarend (hétköznap)"]);
    }
  }

  // 2) napi létszámigény, prioritási sorrendben
  for (let d = 1; d <= n; d++) {
    const dow = dowOf(y, m, d), dt = dayTypeOf(dow), hol = isHoliday(y, m, d);
    for (const g of ["kesz", "tej", "mikro"] as Group[]) {
      const staff = emps.filter((e) => e.group === g && e.pattern === "shift");
      const rows = cfg.reqs.filter((q) => q.group === g && q.dayType === dt && q.count > 0 && cm[q.code]).sort((a, b) => (a.kind === "D" ? -1 : 1) - (b.kind === "D" ? -1 : 1));
      for (const row of rows) {
        const code = row.code, c = cm[code], kind = kindOf(c);
        for (let slot = 0; slot < row.count; slot++) {
          const cands = staff.filter((e) => {
            if (cur[e.id][d]) return false; // távollét vagy már beosztva
            if (restIssue(look, cm, cfg, e.id, d, code)) return false;
            if (1 + runBefore(look, cm, e.id, d) + runAfter(look, cm, e.id, d) > cfg.maxConsecLegal) return false;
            if (conflictPartner(state, cur, cm, e.id, d, kind)) return false;
            return true;
          });
          if (!cands.length) break; // lefedetlen – a validáció jelzi
          const avg = (f: (id: string) => number) => staff.reduce((a, e) => a + f(e.id), 0) / Math.max(staff.length, 1);
          const aN = avg(N), aSA = avg(SA), aSU = avg(SU), aHO = avg(HO);
          const score = (id: string) => {
            const nd = need(id);
            let s = (-nd / 12) * 10;
            if (nd - c.hours < 0) s += 20 + ((c.hours - nd) / 12) * 10; // keret feletti óra
            if (kind === "E") s += (N(id) - aN) * 5;
            else if (groupKinds(cfg, g).has("E")) s -= (N(id) - aN) * 1;
            if (dow === 6) s += (SA(id) - aSA) * 5;
            if (dow === 0) s += (SU(id) - aSU) * 5;
            if (hol) s += (HO(id) - aHO) * 7;
            const rb = runBefore(look, cm, id, d);
            if (cfg.preferMaxConsec.enabled && rb >= cfg.preferMaxConsec.value) s += 15;
            const pc = cm[look(id, d - 1)];
            if (isWork(pc)) s += kindOf(pc) === kind ? -2 : 3;
            return s + rand() * 1.5;
          };
          const scored = cands.map((e) => ({ e, s: score(e.id) })).sort((a, b) => a.s - b.s);
          const best = scored[0].e, others = scored.slice(1).map((x) => x.e.id);
          const reasons = ["elérhető ezen a napon (nincs távollét)", "nincs pihenőidő-ütközés"];
          if (cfg.conflicts.some((x) => x.a === best.id || x.b === best.id)) reasons.push("nincs összeférhetetlen párja ebben a műszakban");
          if (!others.length) reasons.push("egyedül ő volt beosztható erre a műszakra");
          else {
            if (kind === "E" && others.every((o) => N(o) >= N(best.id))) reasons.push(`kevesebb éjszakás műszakja van a kéthavi időszakban (${N(best.id)} db)`);
            if (others.every((o) => need(o) <= need(best.id))) reasons.push(`óraszáma a legjobban elmarad a kerettől (még ${need(best.id)} óra a keretig)`);
            if (dow === 6 && others.every((o) => SA(o) >= SA(best.id))) reasons.push(`kevesebb szombatja van (${SA(best.id)})`);
            if (dow === 0 && others.every((o) => SU(o) >= SU(best.id))) reasons.push(`kevesebb vasárnapja van (${SU(best.id)})`);
            if (hol && others.every((o) => HO(o) >= HO(best.id))) reasons.push(`kevesebb ünnepnapi munkája van (${HO(best.id)})`);
          }
          const pc = cm[look(best.id, d - 1)];
          if (isWork(pc) && kindOf(pc) === kind) reasons.push("folytatja az előző napi műszakot (kevesebb váltás)");
          assign(best.id, d, code, reasons);
        }
      }
    }
  }
  return { id: crypto.randomUUID(), name, createdAt: Date.now(), cells, why };
}

/* ---------------- Validáció ---------------- */

export type Level = "ok" | "warn" | "bad";
export interface Section { id: string; title: string; level: Level; items: { level: Level; text: string }[] }

const worst = (items: { level: Level }[]): Level => (items.some((i) => i.level === "bad") ? "bad" : items.some((i) => i.level === "warn") ? "warn" : "ok");
const shortDate = (m: number, d: number) => `${m + 1}.${String(d).padStart(2, "0")}.`;

export function validate(state: AppState, y: number, m: number, grid: Grid): { sections: Section[]; issues: Set<string> } {
  const cfg = state.config, cm = codeMap(cfg), n = daysIn(y, m);
  const emps = state.employees.filter((e) => e.active);
  const issues = new Set<string>();
  const look = makeLookup(state, y, m, grid);
  const cov = coverage(state, y, m, grid);
  const ms = monthStats(state, y, m, grid);
  const fs = frameStats(state, y, m, grid);

  const covItems = [];
  for (const row of COV_ROWS) for (let d = 1; d <= n; d++) {
    const c = cov[row.id][d];
    if (c.count < c.req) covItems.push({ level: "bad", text: `${shortDate(m, d)} ${row.label}: ${c.req - c.count} fő hiányzik` });
    else if (c.count > c.req) covItems.push({ level: "warn", text: `${shortDate(m, d)} ${row.label}: ${c.count - c.req} fővel több a szükségesnél (${c.names.join(", ")})` });
  }
  if (!covItems.some((i) => i.level === "bad")) covItems.unshift({ level: "ok", text: "Minden kötelező műszak lefedve" });

  const timeItems = [];
  for (const e of emps) {
    const b = ms[e.id].balance;
    if (b > 0) timeItems.push({ level: "warn", text: `${e.name}: +${b} óra havi eltérés (${ms[e.id].total} / ${ms[e.id].target} óra)` });
    else if (b < -12) timeItems.push({ level: "warn", text: `${e.name}: ${b} óra – a havi keret alatt` });
  }
  if (!timeItems.length) timeItems.push({ level: "ok", text: "Minden dolgozó a havi keret közelében" });

  const restItems = [];
  for (const e of emps) for (let d = 1; d <= n; d++) {
    const code = grid[e.id]?.[d]; if (!isWork(cm[code])) continue;
    const r = restIssue(look, cm, cfg, e.id, d, code);
    if (r) { restItems.push({ level: "bad", text: `${e.name}, ${shortDate(m, d)}: ${r}` }); issues.add(`${e.id}-${d}`); }
    if (!isWork(cm[look(e.id, d - 1)])) {
      const run = 1 + runAfter(look, cm, e.id, d);
      if (run > cfg.maxConsecLegal) { restItems.push({ level: "bad", text: `${e.name}: ${run} egymást követő munkanap ${shortDate(m, d)}-tól (max. ${cfg.maxConsecLegal})` }); issues.add(`${e.id}-${d}`); }
      else if (e.pattern === "shift" && cfg.preferMaxConsec.enabled && run > cfg.preferMaxConsec.value) restItems.push({ level: "warn", text: `${e.name}: ${run} egymást követő műszak ${shortDate(m, d)}-tól (céges preferencia: max. ${cfg.preferMaxConsec.value})` });
    }
  }
  if (!restItems.some((i) => i.level === "bad")) restItems.unshift({ level: "ok", text: `Mindenhol megvan a legalább ${cfg.minRest} óra pihenő` });

  const confItems = [];
  for (const cf of cfg.conflicts) {
    const A = state.employees.find((e) => e.id === cf.a), B = state.employees.find((e) => e.id === cf.b);
    if (!A || !B) continue;
    let hit = 0;
    for (let d = 1; d <= n; d++) {
      const a = cm[grid[A.id]?.[d]], b = cm[grid[B.id]?.[d]];
      if (isWork(a) && isWork(b) && kindOf(a) === kindOf(b)) { hit++; issues.add(`${A.id}-${d}`); issues.add(`${B.id}-${d}`); confItems.push({ level: "bad", text: `${shortDate(m, d)}: ${A.name} és ${B.name} ugyanabban a műszakban` }); }
    }
    if (!hit) confItems.push({ level: "ok", text: `${A.name} / ${B.name}: nincs közös műszak` });
  }
  if (!confItems.length) confItems.push({ level: "ok", text: "Nincs összeférhetetlenségi szabály megadva" });

  const absItems = [];
  const md = state.months[monthKey(y, m)];
  let absDays = 0;
  for (const e of emps) {
    const a = md?.absences[e.id] ?? {};
    absDays += Object.keys(a).length;
    const draftCells = activeDraft(md)?.cells[e.id] ?? {};
    for (const d of Object.keys(a)) if (isWork(cm[draftCells[d]])) absItems.push({ level: "bad", text: `${e.name}, ${shortDate(m, +d)}: távollét napjára műszak volt tervezve (a távollét érvényes)` });
    if (fs[e.id].remainingLeave < 0) absItems.push({ level: "warn", text: `${e.name}: ${fs[e.id].remainingLeave} nap – több szabadság, mint a keret` });
  }
  absItems.unshift({ level: "ok", text: `${absDays} távollét-nap rögzítve, ezekre nincs műszak beosztva` });

  const frameItems = [];
  for (const e of emps) {
    const f = fs[e.id];
    if (f.twoMonthBalance > 0) frameItems.push({ level: "warn", text: `${e.name}: kéthavi többlet +${f.twoMonthBalance} óra (keret végén várhatóan ${f.projected >= 0 ? "+" : ""}${f.projected})` });
  }
  const fm = frameMonths(cfg), idx = fm.findIndex(([a, b]) => a === y && b === m);
  if (idx > 0) { const [py, pm] = fm[idx - 1]; if (!hasMonthData(state, py, pm)) frameItems.unshift({ level: "warn", text: "Az előző hónap adatai hiányoznak – a kéthavi egyenleg nem pontos" }); }
  if (!frameItems.length) frameItems.push({ level: "ok", text: "Senki nem lépi túl a kéthavi keretet" });

  const fairItems = [];
  for (const g of ["kesz", "tej", "mikro"] as Group[]) {
    const ge = emps.filter((e) => e.group === g && e.pattern === "shift");
    if (ge.length < 2) continue;
    const spread = (f: (s: MStats) => number, label: string, lim: number) => {
      const vals = ge.map((e) => ({ e, v: f(fs[e.id].cum) }));
      const mx = vals.reduce((a, b) => (b.v > a.v ? b : a)), mn = vals.reduce((a, b) => (b.v < a.v ? b : a));
      if (mx.v - mn.v > lim) fairItems.push({ level: "warn", text: `${GROUP_LABEL[g]} – ${label}: ${mn.e.name} ${mn.v}, ${mx.e.name} ${mx.v} (kéthavi)` });
    };
    if (groupKinds(cfg, g).has("E")) spread((s) => s.night, "éjszakák", 3);
    spread((s) => s.sat, "szombatok", 2);
    spread((s) => s.sun, "vasárnapok", 2);
    spread((s) => s.hol, "ünnepnapok", 1);
  }
  if (!fairItems.length) fairItems.push({ level: "ok", text: "Éjszakák, hétvégék és ünnepnapok kiegyensúlyozottak (kéthavi alapon)" });

  const mk = (id, title, items): Section => ({ id, title, items, level: worst(items) });
  return {
    issues,
    sections: [
      mk("cov", "Lefedettség", covItems), mk("time", "Munkaidő", timeItems), mk("rest", "Pihenőidő", restItems),
      mk("conf", "Konfliktus", confItems), mk("abs", "Szabadság / távollét", absItems), mk("frame", "Kéthavi keret", frameItems),
      mk("fair", "Igazságosság", fairItems),
    ],
  };
}

export function compareDrafts(state: AppState, y: number, m: number) {
  const md = state.months[monthKey(y, m)];
  return (md?.drafts ?? []).map((d) => {
    const g = effGrid(state, y, m, d);
    const cov = coverage(state, y, m, g);
    let missing = 0;
    for (const row of Object.values(cov)) for (const c of Object.values(row)) missing += Math.max(0, c.req - c.count);
    const fs = frameStats(state, y, m, g);
    const emps = state.employees.filter((e) => e.active);
    const plus = emps.reduce((a, e) => a + Math.max(0, fs[e.id].twoMonthBalance), 0);
    const kesz = emps.filter((e) => e.group === "kesz" && e.pattern === "shift");
    const spread = (f: (s: MStats) => number) => { const v = kesz.map((e) => f(fs[e.id].cum)); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
    const v = validate(state, y, m, g);
    const warns = v.sections.reduce((a, s) => a + s.items.filter((i) => i.level !== "ok").length, 0);
    return { id: d.id, name: d.name, missing, plus, nightSpread: spread((s) => s.night), weekendSpread: spread((s) => s.sat + s.sun), warns };
  });
}
