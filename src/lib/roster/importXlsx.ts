// @ts-nocheck -- sheet cell access is dynamic
import * as XLSX from "xlsx";
import type { AppState, Group } from "./types";
import { MONTHS, daysIn, monthKey } from "./calendar";
import { frameMonths } from "./engine";

export interface ImportRow {
  name: string; location: string; leave: number | null; group: Group | null; pattern: "shift" | "fixed8";
  codes: Record<number, string>; stats: Record<string, number>;
}
export interface ImportSheet {
  sheet: string; year: number; month: number; target: number | null; days: number;
  rows: ImportRow[]; unknown: string[]; include: boolean;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const STAT_KEYS: [RegExp, string][] = [
  [/^beteg/, "sick"], [/^ledolg/, "worked"], [/^fiz/, "leave"], [/^osszesen/, "total"], [/^n$/, "day"], [/^e$/, "night"],
  [/^szo/, "sat"], [/^v$/, "sun"], [/^marado/, "remaining"], [/^havi/, "monthBal"], [/^ketha/, "frameBal"],
];
const CONTROL = /nappal|ejszaka|tejatvetel|mikro|desszert|igenyelt/;

export function parseWorkbook(buf: ArrayBuffer, knownCodes: string[]): ImportSheet[] {
  const wb = XLSX.read(buf, { type: "array", cellFormula: true });
  const known = new Set(knownCodes.map((c) => c.toUpperCase()));
  const out: ImportSheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws["!ref"]) continue;
    const rg = XLSX.utils.decode_range(ws["!ref"]);
    const cell = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })];
    const val = (r: number, c: number) => cell(r, c)?.v;

    // cím: "2026 Október"
    let year = 0, month = -1, target: number | null = null;
    for (let r = rg.s.r; r <= Math.min(rg.s.r + 3, rg.e.r); r++) for (let c = rg.s.c; c <= rg.e.c; c++) {
      const v = val(r, c);
      if (typeof v === "string") {
        const mm = norm(v).match(/(\d{4})\s+([a-z]+)/);
        if (mm) { const i = MONTHS.findIndex((x) => norm(x) === mm[2]); if (i >= 0) { year = +mm[1]; month = i; } }
      }
      if (r === rg.s.r && typeof v === "number" && v >= 60 && v <= 300 && target === null) target = v;
    }
    // fejléc sor: napszámok
    let hr = -1, startCol = -1;
    for (let r = rg.s.r; r <= Math.min(rg.s.r + 10, rg.e.r) && hr < 0; r++) {
      const nums: [number, number][] = [];
      for (let c = rg.s.c; c <= rg.e.c; c++) { const v = val(r, c); if (typeof v === "number" && v >= 1 && v <= 31 && Number.isInteger(v)) nums.push([c, v]); }
      if (nums.length >= 20) {
        hr = r;
        const first1 = nums.find(([, v], i) => v === 1 && (i === 0 || nums[i - 1][1] >= 27));
        startCol = first1 ? first1[0] : nums[0][0];
      }
    }
    if (hr < 0 || month < 0) continue;
    const n = daysIn(year, month);
    const statCols: Record<string, number> = {};
    for (let c = startCol + n; c <= rg.e.c; c++) {
      const v = val(hr, c); if (typeof v !== "string") continue;
      const k = STAT_KEYS.find(([re]) => re.test(norm(v)));
      if (k && statCols[k[1]] === undefined) statCols[k[1]] = c;
    }
    // csoportok a vezérlősorok képleteiből (COUNTIF tartományok)
    const groupOfRow: Record<number, Group> = {};
    for (let r = hr + 1; r <= rg.e.r; r++) {
      const lbl = val(r, rg.s.c); if (typeof lbl !== "string") continue;
      const L = norm(lbl);
      const g: Group | null = L.includes("tejatvetel") ? "tej" : L.includes("mikro") ? "mikro" : /\(tr/.test(L) ? "kesz" : null;
      if (!g) continue;
      const f = cell(r, startCol)?.f;
      const mm = f && String(f).match(/COUNTIF\(\$?[A-Z]+\$?(\d+):\$?[A-Z]+\$?(\d+)/i);
      if (mm) for (let x = +mm[1]; x <= +mm[2]; x++) groupOfRow[x - 1] ??= g;
    }
    const rows: ImportRow[] = [];
    const unknown = new Set<string>();
    for (let r = hr + 1; r <= rg.e.r; r++) {
      const nm = val(r, rg.s.c);
      if (typeof nm !== "string" || !nm.trim()) continue;
      if (CONTROL.test(norm(nm))) continue;
      if (norm(nm) === "labor") continue;
      const codes: Record<number, string> = {};
      let eights = 0, works = 0;
      for (let d = 1; d <= n; d++) {
        const v = val(r, startCol + d - 1);
        if (v === undefined || v === null || v === "") continue;
        const code = typeof v === "number" ? String(Math.round(v)) : String(v).trim().toUpperCase();
        if (!code) continue;
        if (!known.has(code)) unknown.add(code);
        codes[d] = code;
        if (/^\d+$/.test(code)) { works++; if (code === "8") eights++; }
      }
      const stats: Record<string, number> = {};
      for (const [k, c] of Object.entries(statCols)) { const v = val(r, c); if (typeof v === "number") stats[k] = v; }
      const lv = val(r, rg.s.c + 2);
      const loc = val(r, rg.s.c + 1);
      rows.push({
        name: nm.trim(), location: typeof loc === "string" ? loc : "", leave: typeof lv === "number" ? lv : null,
        group: groupOfRow[r] ?? null, pattern: works > 5 && eights / works > 0.8 ? "fixed8" : "shift", codes, stats,
      });
    }
    if (!rows.length) continue;
    out.push({ sheet: name, year, month, target, days: n, rows, unknown: [...unknown], include: true });
  }
  return out;
}

export function applyImport(state: AppState, sheets: ImportSheet[]): AppState {
  const s: AppState = structuredClone(state);
  const blocking = new Set(s.config.codes.filter((c) => c.category !== "work").map((c) => c.code));
  const leaveCodes = new Set(s.config.codes.filter((c) => c.category === "leave").map((c) => c.code));
  const inc = sheets.filter((x) => x.include).sort((a, b) => a.year - b.year || a.month - b.month);
  const fm = frameMonths(s.config).map(([y, m]) => monthKey(y, m));
  const leaveSet = new Set<string>();
  for (const sh of inc) {
    const key = monthKey(sh.year, sh.month);
    const absences = {}, cells = {};
    for (const row of sh.rows) {
      let e = s.employees.find((x) => norm(x.name) === norm(row.name));
      if (!e) {
        e = { id: crypto.randomUUID(), name: row.name, group: row.group ?? "kesz", location: row.location, leaveBalance: row.leave ?? 0, pattern: row.pattern, active: true };
        s.employees.push(e);
      } else {
        if (row.group) e.group = row.group;
        if (row.location) e.location = row.location;
      }
      absences[e.id] = {}; cells[e.id] = {};
      for (const [d, c] of Object.entries(row.codes)) (blocking.has(c) ? absences : cells)[e.id][+d] = c;
      // szabadságkeret a munkaidőkeret elejére visszavetítve
      const pos = fm.indexOf(key);
      if (row.leave !== null && !leaveSet.has(e.id) && pos >= 0) {
        let used = 0;
        for (const k of fm.slice(0, pos)) for (const c of Object.values(s.months[k]?.absences[e.id] ?? {})) if (leaveCodes.has(c)) used++;
        e.leaveBalance = row.leave + used;
        leaveSet.add(e.id);
      }
    }
    const id = crypto.randomUUID();
    const prev = s.months[key];
    s.months[key] = {
      absences,
      drafts: [...(prev?.drafts ?? []), { id, name: `Importált: ${sh.sheet}`, createdAt: Date.now(), cells, why: {} }],
      activeId: id,
    };
    if (sh.target) s.config.targets[key] = sh.target;
  }
  return s;
}
