// Futtatás: bun test tests/
import { describe, expect, test } from "bun:test";
import { initialState, migrate } from "../src/lib/roster/defaults";
import { checkCell, effGrid, generate, nightEligible, validate } from "../src/lib/roster/engine";
import { dowOf } from "../src/lib/roster/calendar";
import type { AppState } from "../src/lib/roster/types";

const NOV = 10, OCT = 9, Y = 2026;
const ZSOFIA = "e7", MARICA = "e2";

function withAbs(s: AppState, key: string, id: string, d: number, code: string): AppState {
  const md = s.months[key] ?? { absences: {}, drafts: [], activeId: null };
  return { ...s, months: { ...s.months, [key]: { ...md, absences: { ...md.absences, [id]: { ...(md.absences[id] ?? {}), [d]: code } } } } };
}
function withDraft(s: AppState, key: string, cells: Record<string, Record<number, string>>, locked: Record<string, boolean> = {}): AppState {
  const md = s.months[key] ?? { absences: {}, drafts: [], activeId: null };
  const d = { id: "t", name: "teszt", createdAt: 0, cells, why: {}, locked };
  return { ...s, months: { ...s.months, [key]: { ...md, drafts: [d], activeId: "t" } } };
}

describe("éjszaka tiltó távollét előtt", () => {
  for (const code of ["SZ", "X", "O4", "O8"]) {
    test(`${code} nov. 11 → nincs 19-es nov. 10-én`, () => {
      const s = withAbs(initialState(), "2026-11", MARICA, 11, code);
      for (let seed = 1; seed <= 8; seed++) {
        const d = generate(s, Y, NOV, seed, "x");
        expect(d.cells[MARICA]?.[10]).not.toBe("19");
      }
    });
  }
  test("B (beteg) előtt alapból nincs tiltás", () => {
    const s = withAbs(initialState(), "2026-11", MARICA, 11, "B");
    const g = effGrid(s, Y, NOV);
    expect(checkCell(s, Y, NOV, g, MARICA, 10, "19").some((t) => t.includes("másnapra"))).toBe(false);
  });
  test("kézi beírás jelez", () => {
    const s = withAbs(initialState(), "2026-11", MARICA, 11, "SZ");
    const g = effGrid(s, Y, NOV);
    expect(checkCell(s, Y, NOV, g, MARICA, 10, "19").some((t) => t.includes("másnapra SZ"))).toBe(true);
  });
  test("hónaphatár: okt. 31 éjszaka + nov. 1 SZ jelölve, nem törölve", () => {
    let s = withDraft(initialState(), "2026-10", { [MARICA]: { 31: "19" } });
    s = withAbs(s, "2026-11", MARICA, 1, "SZ");
    const oct = validate(s, Y, OCT, effGrid(s, Y, OCT));
    expect(oct.issues.has(`${MARICA}-31`)).toBe(true);
    expect(effGrid(s, Y, OCT)[MARICA]?.[31]).toBe("19");
    const nov = validate(s, Y, NOV, effGrid(s, Y, NOV));
    expect(nov.issues.has(`${MARICA}-1`)).toBe(true);
  });
  test("hónaphatár a generátorban: nov. 1 SZ → nincs okt. 31 éjszaka", () => {
    const s = withAbs(initialState(), "2026-11", MARICA, 1, "SZ");
    for (let seed = 1; seed <= 8; seed++) expect(generate(s, Y, OCT, seed, "x").cells[MARICA]?.[31]).not.toBe("19");
  });
});

describe("egyéni beosztási szabály – Szalacsi Zsófia", () => {
  test("nincs szombat éjszaka és vasárnap nappal", () => {
    const s = initialState();
    let nights = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const d = generate(s, Y, NOV, seed, "x");
      for (const [ds, c] of Object.entries(d.cells[ZSOFIA] ?? {})) {
        const dow = dowOf(Y, NOV, +ds);
        if (dow === 6) expect(c).not.toBe("19");
        if (dow === 0) expect(c).not.toBe("7");
        if (c === "19") nights++;
      }
    }
    expect(nights).toBeGreaterThan(0); // a többi éjszaka elérhető marad
  });
  test("kézi beírás jelez", () => {
    const s = initialState();
    const sat = [...Array(30).keys()].map((i) => i + 1).find((d) => dowOf(Y, NOV, d) === 6)!;
    expect(checkCell(s, Y, NOV, effGrid(s, Y, NOV), ZSOFIA, sat, "19").some((t) => t.includes("egyéni"))).toBe(true);
  });
});

describe("zárolt kézi műszak", () => {
  test("Daruka Zoltánné nov. 1 éjszaka megmarad és zárolt", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const d = generate(initialState(), Y, NOV, seed, "x", { [MARICA]: { 1: "19" } });
      expect(d.cells[MARICA]?.[1]).toBe("19");
      expect(d.locked?.[`${MARICA}-1`]).toBe(true);
    }
  });
});

describe("éjszaka-igazságosság", () => {
  test("minden éjszakára beosztható desszertes kap éjszakát novemberben", () => {
    const s = initialState();
    const kesz = s.employees.filter((e) => e.active && e.group === "kesz" && e.pattern === "shift");
    for (let seed = 1; seed <= 10; seed++) {
      const d = generate(s, Y, NOV, seed, "x");
      for (const e of kesz) {
        if (nightEligible(s, Y, NOV, e) < 4) continue;
        const n = Object.values(d.cells[e.id] ?? {}).filter((c) => c === "19").length;
        expect(n).toBeGreaterThan(0);
      }
    }
  });
});

describe("adatbővítés (régi mentés)", () => {
  test("O4/O8 és Zsófia szabályai bekerülnek, meglévő adat nem változik", () => {
    const base = initialState();
    const old: AppState = {
      ...base,
      migrations: undefined as never,
      config: { ...base.config, codes: base.config.codes.filter((c) => c.code !== "O4" && c.code !== "O8") },
      employees: base.employees.map(({ restrictions: _r, ...e }) => e),
    };
    delete (old as Partial<AppState>).migrations;
    const m = migrate(old);
    expect(m.config.codes.some((c) => c.code === "O8")).toBe(true);
    expect(m.employees.find((e) => e.id === ZSOFIA)?.restrictions?.length).toBe(2);
    expect(m.employees.map((e) => e.id)).toEqual(old.employees.map((e) => e.id));
    // a felhasználó által törölt szabály nem jön vissza
    const cleared = { ...m, employees: m.employees.map((e) => (e.id === ZSOFIA ? { ...e, restrictions: [] } : e)) };
    expect(migrate(cleared).employees.find((e) => e.id === ZSOFIA)?.restrictions).toEqual([]);
  });
});
