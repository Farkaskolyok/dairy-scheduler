export type Group = "tej" | "kesz" | "baci";
export type Kind = "N" | "E"; // Nappal / Éjszaka

export interface Employee {
  id: string;
  name: string;
  group: Group;
  leave: number[]; // day numbers of the month
}

export interface Req {
  kind: Kind;
  count: number;
  hours: number;
}

export const GROUP_LABEL: Record<Group, string> = {
  tej: "Tejátvétel",
  kesz: "Késztermék labor",
  baci: "Bakteriológia (bacis)",
};

// dow: 0 = vasárnap ... 6 = szombat
export function requirements(group: Group, dow: number): Req[] {
  if (group === "tej") return [{ kind: "N", count: 1, hours: 12 }];
  if (group === "kesz") {
    if (dow === 0) return [{ kind: "E", count: 1, hours: 12 }];
    if (dow === 6)
      return [
        { kind: "N", count: 1, hours: 12 },
        { kind: "E", count: 1, hours: 12 },
      ];
    return [
      { kind: "N", count: 2, hours: 12 },
      { kind: "E", count: 2, hours: 12 },
    ];
  }
  if (dow === 0) return [{ kind: "N", count: 1, hours: 4 }];
  if (dow === 6) return [{ kind: "N", count: 1, hours: 8 }];
  return [{ kind: "N", count: 1, hours: 12 }];
}

function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

export function holidays(y: number): Set<string> {
  const s = new Set<string>();
  const add = (d: Date) => s.add(`${d.getMonth() + 1}-${d.getDate()}`);
  [[1, 1], [3, 15], [5, 1], [8, 20], [10, 23], [11, 1], [12, 25], [12, 26]].forEach(([m, d]) =>
    add(new Date(y, m - 1, d)),
  );
  const e = easter(y);
  const off = (n: number) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + n);
  add(off(-2)); add(off(1)); add(off(50));
  return s;
}

export const isHoliday = (y: number, m: number, d: number) => holidays(y).has(`${m + 1}-${d}`);
export const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Havi általános munkaidő (munkanapok × 8 óra) */
export function monthTarget(y: number, m: number) {
  let t = 0;
  for (let d = 1; d <= daysIn(y, m); d++) {
    const dow = new Date(y, m, d).getDay();
    if (dow !== 0 && dow !== 6 && !isHoliday(y, m, d)) t += 8;
  }
  return t;
}

export interface Cell { kind: Kind | "SZ"; hours: number }
export interface Result {
  grid: Record<string, Record<number, Cell>>;
  gaps: { day: number; group: Group; kind: Kind; missing: number }[];
  stats: Record<string, { hours: number; target: number; nights: number; weekends: number; holidays: number; leave: number }>;
}

export function generate(
  emps: Employee[], y: number, m: number, conflicts: [string, string][], seed = 1,
): Result {
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const n = daysIn(y, m);
  const base = monthTarget(y, m);
  const grid: Result["grid"] = {};
  const stats: Result["stats"] = {};
  const gaps: Result["gaps"] = [];

  for (const e of emps) {
    grid[e.id] = {};
    let leaveH = 0;
    for (const d of e.leave) {
      if (d < 1 || d > n) continue;
      const dow = new Date(y, m, d).getDay();
      const work = dow !== 0 && dow !== 6 && !isHoliday(y, m, d);
      grid[e.id][d] = { kind: "SZ", hours: work ? 8 : 0 };
      leaveH += work ? 8 : 0;
    }
    stats[e.id] = { hours: leaveH, target: base, nights: 0, weekends: 0, holidays: 0, leave: leaveH };
  }
  const nameOf = Object.fromEntries(emps.map((e) => [e.id, e.name.trim().toLowerCase()]));
  const clash = (a: string, b: string) =>
    conflicts.some(([x, y2]) => {
      const X = x.trim().toLowerCase(), Y = y2.trim().toLowerCase();
      return (nameOf[a] === X && nameOf[b] === Y) || (nameOf[a] === Y && nameOf[b] === X);
    });

  const worked = (id: string, d: number) => {
    const c = grid[id][d];
    return c && c.kind !== "SZ";
  };
  const consec = (id: string, d: number) => {
    let c = 0;
    for (let k = d - 1; k >= 1 && worked(id, k); k--) c++;
    return c;
  };

  for (let d = 1; d <= n; d++) {
    const dow = new Date(y, m, d).getDay();
    const weekend = dow === 0 || dow === 6;
    const hol = isHoliday(y, m, d);
    for (const g of ["tej", "kesz", "baci"] as Group[]) {
      const staff = emps.filter((e) => e.group === g);
      for (const req of requirements(g, dow)) {
        const chosen: string[] = [];
        for (let slot = 0; slot < req.count; slot++) {
          const pick = (strict: boolean) => {
            const cands = staff.filter((e) => {
              if (grid[e.id][d]) return false;
              const prev = grid[e.id][d - 1];
              // 11 óra pihenőidő: éjszaka után másnap nem lehet nappal
              if (req.kind === "N" && prev && prev.kind === "E") return false;
              if (chosen.some((c) => clash(c, e.id))) return false;
              if (strict) {
                if (consec(e.id, d) >= 3) return false;
                if (stats[e.id].hours + req.hours > stats[e.id].target + 24) return false;
              } else if (consec(e.id, d) >= 5) return false;
              return true;
            });
            if (!cands.length) return null;
            const s = (e: Employee) => {
              const st = stats[e.id];
              let v = (st.hours / Math.max(st.target, 1)) * 100;
              if (req.kind === "E") v += st.nights * 6;
              if (weekend) v += st.weekends * 6;
              if (hol) v += st.holidays * 10;
              // folytatás ugyanabban a műszakban kedvezményes (kevesebb váltás)
              const prev = grid[e.id][d - 1];
              if (prev && prev.kind === req.kind) v -= 3;
              return v + rand() * 4;
            };
            return cands.sort((a, b) => s(a) - s(b))[0];
          };
          const e = pick(true) ?? pick(false);
          if (!e) {
            gaps.push({ day: d, group: g, kind: req.kind, missing: req.count - slot });
            break;
          }
          chosen.push(e.id);
          grid[e.id][d] = { kind: req.kind, hours: req.hours };
          const st = stats[e.id];
          st.hours += req.hours;
          if (req.kind === "E") st.nights++;
          if (weekend) st.weekends++;
          if (hol) st.holidays++;
        }
      }
    }
  }
  return { grid, gaps, stats };
}
