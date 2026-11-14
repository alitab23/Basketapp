import type { Block } from '../types/model';

const DAY = 24 * 60;

/** "18:00" → 1080. Invalid input gives null. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 1100 → "18:20". Wraps past midnight; use `dayOffset` to show "+1". */
export function formatClock(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface ScheduleRow {
  id: string;
  kind: Block['kind'];
  /** Minutes since midnight of the session day (may exceed 1440). */
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
  /** 1 when the block starts on the next day. */
  dayOffset: number;
  /** For section rows: sum of the blocks until the next section. */
  sectionMinutes?: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  /** Total minutes; section rows count as 0. */
  total: number;
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
  endDayOffset: number;
}

/**
 * The exact rule from SPEC.md section 4: a block starts at the session start
 * plus the length of all earlier blocks; it ends at start + its own length;
 * total = sum of all blocks, where section rows count as 0.
 */
export function calculateSchedule(startTime: string, items: readonly Block[]): Schedule {
  const start = parseClock(startTime) ?? 0;
  let cursor = start;
  const rows: ScheduleRow[] = [];
  let currentSection: ScheduleRow | null = null;

  for (const item of items) {
    const duration = item.kind === 'section' ? 0 : Math.max(0, item.duration);
    const row: ScheduleRow = {
      id: item.id,
      kind: item.kind,
      start: cursor,
      end: cursor + duration,
      startLabel: formatClock(cursor),
      endLabel: formatClock(cursor + duration),
      dayOffset: Math.floor(cursor / DAY),
    };
    if (item.kind === 'section') {
      row.sectionMinutes = 0;
      currentSection = row;
    } else if (currentSection) {
      currentSection.sectionMinutes = (currentSection.sectionMinutes ?? 0) + duration;
    }
    rows.push(row);
    cursor += duration;
  }

  return {
    rows,
    total: cursor - start,
    start,
    end: cursor,
    startLabel: formatClock(start),
    endLabel: formatClock(cursor),
    endDayOffset: Math.floor(cursor / DAY),
  };
}

/** Minutes per block type, in first-seen order, for the summary bar. */
export function minutesByBlockType(items: readonly Block[]): { blockTypeId: string | null; minutes: number }[] {
  const map = new Map<string | null, number>();
  for (const b of items) {
    if (b.kind === 'section' || b.duration <= 0) continue;
    const key = b.blockTypeId ?? null;
    map.set(key, (map.get(key) ?? 0) + b.duration);
  }
  return [...map].map(([blockTypeId, minutes]) => ({ blockTypeId, minutes }));
}
