import type { AppState, CodeDef, Config, Grid, ReqRow, RuleType } from "./types";
import { SEED_EMPLOYEES, SEED_OCT_2026_ABSENCES, SEED_SEPT_2026 } from "./seed";

export const GROUP_LABEL = {
  kesz: "Késztermék / Desszert labor",
  tej: "Tejátvétel",
  mikro: "Mikrolabor / Bakteriológia",
} as const;
export const GROUPS = ["kesz", "tej", "mikro"] as const;

export const COLOR_KEYS = ["day", "night", "short", "sz", "b", "x", "ho", "other"] as const;

export const DEFAULT_CODES: CodeDef[] = [
  { code: "7", name: "07:00-tól (nappal)", category: "work", hours: 12, start: 7, countsWork: true, countsAccounted: true, blocks: false, color: "day", description: "07:00–19:00, 12 óra (Excel: 7 × 12 óra)" },
  { code: "19", name: "19:00-tól (éjszaka)", category: "work", hours: 12, start: 19, countsWork: true, countsAccounted: true, blocks: false, color: "night", description: "19:00–07:00, 12 óra (Excel: 19 × 12 óra)" },
  { code: "8", name: "8 óra", category: "work", hours: 8, start: 7, countsWork: true, countsAccounted: true, blocks: false, color: "short", description: "8 órás nappali munka (pl. szombati mikro, fix 8 órás munkarend)" },
  { code: "4", name: "4 óra", category: "work", hours: 4, start: 7, countsWork: true, countsAccounted: true, blocks: false, color: "short", description: "4 órás munka (pl. vasárnapi mikro)" },
  { code: "SZ", name: "Fizetett szabadság", category: "leave", hours: 8, start: 0, countsWork: false, countsAccounted: true, blocks: true, color: "sz", description: "Excel: Fiz.szab = SZ × 8 óra; beleszámít az Összesenbe" },
  { code: "B", name: "Betegség", category: "sick", hours: 8, start: 0, countsWork: false, countsAccounted: true, blocks: true, color: "b", description: "Excel: Beteg órák = B × 8 óra; beleszámít az Összesenbe" },
  { code: "X", name: "Nem beosztható", category: "other", hours: 0, start: 0, countsWork: false, countsAccounted: false, blocks: true, color: "x", description: "Az Excel óraként nem számolja; a nap nem osztható be" },
  { code: "HO", name: "Egyéb távollét (HO)", category: "other", hours: 0, start: 0, countsWork: false, countsAccounted: false, blocks: true, color: "ho", description: "Az Excel óraként nem számolja – bérszámfejtési jelentését a rendszergazda állítsa be" },
];

export const DEFAULT_REQS: ReqRow[] = [
  { group: "kesz", dayType: "wd", kind: "D", count: 2, code: "7" },
  { group: "kesz", dayType: "wd", kind: "E", count: 2, code: "19" },
  { group: "kesz", dayType: "sat", kind: "D", count: 1, code: "7" },
  { group: "kesz", dayType: "sat", kind: "E", count: 1, code: "19" },
  { group: "kesz", dayType: "sun", kind: "D", count: 0, code: "7" },
  { group: "kesz", dayType: "sun", kind: "E", count: 1, code: "19" },
  { group: "tej", dayType: "wd", kind: "D", count: 1, code: "7" },
  { group: "tej", dayType: "sat", kind: "D", count: 1, code: "7" },
  { group: "tej", dayType: "sun", kind: "D", count: 1, code: "7" },
  { group: "mikro", dayType: "wd", kind: "D", count: 1, code: "7" },
  { group: "mikro", dayType: "sat", kind: "D", count: 1, code: "8" },
  { group: "mikro", dayType: "sun", kind: "D", count: 1, code: "4" },
];

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  LEGAL_HARD: "Jogszabályi kemény szabály",
  COMPANY_HARD: "Céges kemény szabály",
  STAFFING: "Létszámigény",
  AVAILABILITY: "Dolgozói elérhetőség",
  PREFERENCE: "Preferencia",
  FAIRNESS: "Igazságossági cél",
};

export function defaultConfig(): Config {
  return {
    frameStart: "2026-09-01",
    frameEnd: "2026-10-31",
    targets: { "2026-09": 176, "2026-10": 168 },
    codes: DEFAULT_CODES.map((c) => ({ ...c })),
    reqs: DEFAULT_REQS.map((r) => ({ ...r })),
    conflicts: [{ id: "c1", a: "e3", b: "e4" }], // Egriné Elek Krisztina + Kissné Bancsi Tünde
    minRest: 11,
    maxConsecLegal: 6,
    preferMaxConsec: { enabled: true, value: 3 },
  };
}

const STATUS = new Set(["SZ", "B", "X", "HO"]);
export function initialState(): AppState {
  const sepAbs: Grid = {}, sepWork: Grid = {};
  for (const [id, row] of Object.entries(SEED_SEPT_2026)) {
    sepAbs[id] = {}; sepWork[id] = {};
    for (const [d, c] of Object.entries(row)) {
      (STATUS.has(c) ? sepAbs[id] : sepWork[id])![Number(d)] = c;
    }
  }
  const octAbs: Grid = {};
  for (const [id, row] of Object.entries(SEED_OCT_2026_ABSENCES)) {
    octAbs[id] = Object.fromEntries(Object.entries(row).map(([d, c]) => [Number(d), c]));
  }
  return {
    version: 2,
    employees: SEED_EMPLOYEES.map((e) => ({ ...e })),
    config: defaultConfig(),
    months: {
      "2026-09": {
        absences: sepAbs,
        drafts: [{ id: "sep-real", name: "Valós szeptemberi beosztás", createdAt: 0, cells: sepWork, why: {} }],
        activeId: "sep-real",
      },
      "2026-10": { absences: octAbs, drafts: [], activeId: null },
    },
  };
}
