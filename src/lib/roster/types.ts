export type Group = "kesz" | "tej" | "mikro";
export type Pattern = "shift" | "fixed8";
export type Kind = "D" | "E"; // nappal / éjszaka
export type DayType = "wd" | "sat" | "sun";

export interface Employee {
  id: string;
  name: string;
  group: Group;
  location: string;
  /** Szabadságkeret (nap) a munkaidőkeret kezdetén */
  leaveBalance: number;
  pattern: Pattern;
  active: boolean;
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
}
