import { calculateSchedule } from '../lib/schedule';
import { blockTypeName } from '../lib/blockTypeName';
import type { BlockType, Session } from '../types/model';

type Translate = (key: string) => string;

/** Semicolon, because Swedish Excel uses the comma as decimal separator. */
export const CSV_SEPARATOR = ';';
/** Byte order mark, so Excel reads the file as UTF-8 (å, ä, ö). */
export const BOM = '﻿';

export function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return /[";\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const line = (cells: (string | number | undefined)[]) => cells.map(csvCell).join(CSV_SEPARATOR);

/**
 * One row per block with start, end, title, block type, minutes and instruction
 * (SPEC.md section 7). Section rows keep their place with start and title only,
 * so a sum of the minutes column is still the session's total.
 * A season export gets date and session title first.
 */
export function sessionsToCsv(sessions: readonly Session[], blockTypes: readonly BlockType[], t: Translate, withSession = sessions.length > 1): string {
  const types = new Map(blockTypes.map((b) => [b.id, b]));
  const head = [t('csv.start'), t('csv.end'), t('csv.title'), t('csv.blockType'), t('csv.minutes'), t('csv.instructions')];
  const rows = [line(withSession ? [t('csv.date'), t('csv.session'), ...head] : head)];
  for (const s of sessions) {
    const schedule = calculateSchedule(s.startTime, s.items);
    s.items.forEach((b, i) => {
      const r = schedule.rows[i]!;
      const type = b.blockTypeId ? types.get(b.blockTypeId) : undefined;
      const cells =
        b.kind === 'section'
          ? [r.startLabel, '', b.title, '', '', '']
          : [r.startLabel, r.endLabel, b.title, type ? blockTypeName(type, t) : '', b.duration, b.instructions.trim()];
      rows.push(line(withSession ? [s.date ?? '', s.title, ...cells] : cells));
    });
  }
  return BOM + rows.join('\r\n') + '\r\n';
}

/** "basketapp-tisdagspass-2026-11-14.csv" etc. */
export function withExtension(jsonName: string, ext: 'csv' | 'pdf' | 'png' | 'svg'): string {
  return jsonName.replace(/\.json$/, `.${ext}`);
}

/** Starts a browser download of a blob. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
