import { useCallback, useSyncExternalStore } from 'react';

/** Court colour is a viewing preference per browser, not part of the data. */
export type CourtStyle = 'wood' | 'white';

export const COURT_COLORS: Record<CourtStyle, { floor: string; paint: string; line: string; outside: string }> = {
  wood: { floor: '#E8C597', paint: '#D9A764', line: '#FFFFFF', outside: '#C99A62' },
  white: { floor: '#FFFFFF', paint: '#F1F5F9', line: '#1F2937', outside: '#FFFFFF' },
};

const KEY = 'basketapp.courtStyle';
const listeners = new Set<() => void>();

function read(): CourtStyle {
  try {
    return localStorage.getItem(KEY) === 'white' ? 'white' : 'wood';
  } catch {
    return 'wood';
  }
}

export function useCourtStyle(): [CourtStyle, (s: CourtStyle) => void] {
  const style = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => 'wood' as const,
  );
  const set = useCallback((s: CourtStyle) => {
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);
  return [style, set];
}
