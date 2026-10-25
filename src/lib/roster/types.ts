export type Group = "kesz" | "tej" | "mikro";
export type Pattern = "shift" | "fixed8";
export type Kind = "D" | "E"; // nappal / éjszaka
export type DayType = "wd" | "sat" | "sun";

/** Állandó, ismétlődő egyéni tiltás: a hét adott napján adott műszaktípus nem osztható be */
export interface Restriction {
  id: string;
  /** 0 = vasárnap … 6 = szombat */
  dow: number;
  kind: Kind;
  enabled: boolean;
}

export interface Employee {
  id: string;
  name: string;
  group: Group;
  location: string;
  /** Szabadságkeret (nap) a munkaidőkeret kezdetén */
  leaveBalance: number;
  pattern: Pattern;
  active: boolean;
  /** Egyéni beosztási szabályok (régi mentésben hiányozhat) */
  restrictions?: Restriction[];
}

export type CodeCategory = "work" | "leave" | "sick" | "other";

export interface CodeDef {
  code: string;
  name: string;
  category: CodeCategory;
  /** munkakódnál ledolgozott óra, távollétnél fizetett óra */
  hours: number;
  /** kezdési óra (munkakódok) */
  start: number;
  countsWork: boolean;
  countsAccounted: boolean;
  blocks: boolean;
  color: string; // színkulcs, pl. "day"
  description: string;
  /** Ha a távollét D napon van, D−1 napon nem lehet 19:00-s éjszakás műszak.
   *  Hiányzó érték esetén: SZ, X, O4, O8 = igen, a többi = nem. */
  blocksPreviousNight?: boolean;
}

export interface ReqRow {
  group: Group;
  dayType: DayType;
  kind: Kind;
  count: number;
  code: string;
}

export type RuleType =
  | "LEGAL_HARD"
  | "COMPANY_HARD"
  | "STAFFING"
  | "AVAILABILITY"
  | "PREFERENCE"
  | "FAIRNESS";

export interface Conflict {
  id: string;
  a: string; // employee id
  b: string;
}

export interface Config {
  frameStart: string; // YYYY-MM-DD
  frameEnd: string;
  targets: Record<string, number>; // "2026-10" -> 168 (kézi felülírás)
  codes: CodeDef[];
  reqs: ReqRow[];
  conflicts: Conflict[];
  minRest: number;
  maxConsecLegal: number;
  preferMaxConsec: { enabled: boolean; value: number };
}

/** empId -> nap -> kód */
export type Grid = Record<string, Record<number, string>>;

export interface Draft {
  id: string;
  name: string;
  createdAt: number;
  cells: Grid;
  why: Record<string, string[]>; // `${empId}-${day}`
  /** Kézzel beírt, zárolt műszakok: `${empId}-${day}` -> true (régi tervezetben hiányzik) */
  locked?: Record<string, boolean>;
}

export interface MonthData {
  absences: Grid;
  drafts: Draft[];
  activeId: string | null;
}

export interface AppState {
  version: 2;
  employees: Employee[];
  config: Config;
  months: Record<string, MonthData>;
  /** Már lefutott egyszeri adatbővítések azonosítói */
  migrations?: string[];
}
