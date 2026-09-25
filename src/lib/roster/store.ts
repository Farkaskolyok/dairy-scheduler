import { useEffect, useState } from "react";
import type { AppState, MonthData } from "./types";
import { initialState } from "./defaults";

const KEY = "potty-beosztas-v2";

export function useRosterState() {
  const [state, setState] = useState<AppState>(initialState);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as AppState;
        if (p.version === 2) setState(p);
      }
    } catch { /* hibás mentés – alapállapot */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, loaded]);
  return [state, setState] as const;
}

export const emptyMonth = (): MonthData => ({ absences: {}, drafts: [], activeId: null });

export function withMonth(s: AppState, key: string, fn: (md: MonthData) => MonthData): AppState {
  return { ...s, months: { ...s.months, [key]: fn(s.months[key] ?? emptyMonth()) } };
}
