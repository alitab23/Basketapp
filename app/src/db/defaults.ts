import type { BlockType } from '../types/model';

/**
 * Default basketball block types (SPEC.md section 4). Stable ids make seeding
 * idempotent. Names come from the translation files via `nameKey`.
 */
export const DEFAULT_BLOCK_TYPES: readonly { id: string; nameKey: string; icon: string; color: string }[] = [
  { id: 'bt-warmup', nameKey: 'blockTypes.warmup', icon: 'flame', color: '#F59E0B' },
  { id: 'bt-technique', nameKey: 'blockTypes.technique', icon: 'target', color: '#3B82F6' },
  { id: 'bt-shooting', nameKey: 'blockTypes.shooting', icon: 'basketball', color: '#EF4444' },
  { id: 'bt-offense', nameKey: 'blockTypes.offense', icon: 'arrow-up-right', color: '#22C55E' },
  { id: 'bt-defense', nameKey: 'blockTypes.defense', icon: 'shield', color: '#8B5CF6' },
  { id: 'bt-scrimmage', nameKey: 'blockTypes.scrimmage', icon: 'users', color: '#F97316' },
  { id: 'bt-conditioning', nameKey: 'blockTypes.conditioning', icon: 'heart-pulse', color: '#EC4899' },
  { id: 'bt-break', nameKey: 'blockTypes.break', icon: 'cup', color: '#6B7280' },
];

export function buildDefaultBlockTypes(translate: (key: string) => string): BlockType[] {
  return DEFAULT_BLOCK_TYPES.map(({ id, nameKey, icon, color }) => ({
    id,
    teamId: null,
    name: translate(nameKey),
    icon,
    color,
  }));
}
