export const MONTHS = ["január","február","március","április","május","június","július","augusztus","szeptember","október","november","december"];
export const MONTH_ADJ = ["januári","februári","márciusi","áprilisi","májusi","júniusi","júliusi","augusztusi","szeptemberi","októberi","novemberi","decemberi"];
export const DOW = ["V", "H", "K", "Sz", "Cs", "P", "Szo"];

function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

const cache = new Map<number, Set<string>>();
export function holidays(y: number): Set<string> {
  const hit = cache.get(y);
  if (hit) return hit;
  const s = new Set<string>();
  const add = (d: Date) => s.add(`${d.getMonth() + 1}-${d.getDate()}`);
  const fixed: [number, number][] = [[1, 1], [3, 15], [5, 1], [8, 20], [10, 23], [11, 1], [12, 25], [12, 26]];
  fixed.forEach(([m, d]) => add(new Date(y, m - 1, d)));
  const e = easter(y);
  const off = (n: number) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + n);
  add(off(-2)); add(off(1)); add(off(50));
  cache.set(y, s);
  return s;
}

export const isHoliday = (y: number, m: number, d: number) => {
  const dt = new Date(y, m, d);
  return holidays(dt.getFullYear()).has(`${dt.getMonth() + 1}-${dt.getDate()}`);
};
export const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
export const dowOf = (y: number, m: number, d: number) => new Date(y, m, d).getDay();
export const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
export const prevMonth = (y: number, m: number): [number, number] => (m === 0 ? [y - 1, 11] : [y, m - 1]);
export const nextMonth = (y: number, m: number): [number, number] => (m === 11 ? [y + 1, 0] : [y, m + 1]);

/** Általános munkarend szerinti havi keret (munkanapok × 8 óra) */
export function autoMonthTarget(y: number, m: number) {
  let t = 0;
  for (let d = 1; d <= daysIn(y, m); d++) {
    const dow = dowOf(y, m, d);
    if (dow !== 0 && dow !== 6 && !isHoliday(y, m, d)) t += 8;
  }
  return t;
}

export function parseYM(s: string): [number, number] {
  const [y, m] = s.split("-").map(Number);
  return [y ?? 2026, (m ?? 1) - 1];
}
