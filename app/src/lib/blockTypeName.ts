import { DEFAULT_BLOCK_TYPES } from '../db/defaults';
import type { BlockType } from '../types/model';
import sv from '../i18n/sv.json';
import en from '../i18n/en.json';

const defaults = new Map(DEFAULT_BLOCK_TYPES.map((d) => [d.id, d.nameKey]));
const lookup = (tree: unknown, key: string): string | undefined =>
  key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree) as
    | string
    | undefined;

/**
 * The name of a block type in the chosen language. Default block types are
 * stored with the name in the language that was active when they were created;
 * as long as the user has not renamed one, it follows the export language.
 */
export function blockTypeName(bt: Pick<BlockType, 'id' | 'name'>, translate: (key: string) => string): string {
  const key = defaults.get(bt.id);
  if (key && (bt.name === lookup(sv, key) || bt.name === lookup(en, key))) return translate(key);
  return bt.name;
}
