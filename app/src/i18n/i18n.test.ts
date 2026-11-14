import { describe, expect, it } from 'vitest';
import sv from './sv.json';
import en from './en.json';
import { DEFAULT_BLOCK_TYPES } from '../db/defaults';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function lookup(obj: object, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}

describe('translations', () => {
  it('Swedish and English have exactly the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(sv).sort());
  });

  it('no translation is empty', () => {
    for (const [lang, file] of [['sv', sv], ['en', en]] as const) {
      for (const k of keys(file)) {
        expect(lookup(file, k), `${lang}:${k}`).not.toBe('');
      }
    }
  });

  it('every default block type has a name in both languages', () => {
    for (const { nameKey } of DEFAULT_BLOCK_TYPES) {
      expect(typeof lookup(sv, nameKey)).toBe('string');
      expect(typeof lookup(en, nameKey)).toBe('string');
    }
  });
});
