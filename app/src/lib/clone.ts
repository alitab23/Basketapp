import type { Block, Diagram, Drill, ImageAttachment, Session } from '../types/model';
import { newId } from './id';

/**
 * Deep copies with new ids. Element ids inside a drawing are kept: they only
 * need to be unique within their drawing, and arrows refer to players by them.
 */
export function cloneDiagram(d: Diagram): Diagram {
  return { ...structuredClone(d), id: newId() };
}

/** Photos get new attachment ids but keep pointing at the same stored image data. */
export function cloneImage(i: ImageAttachment): ImageAttachment {
  return { ...structuredClone(i), id: newId() };
}

export function cloneBlock(b: Block): Block {
  const copy = structuredClone(b);
  return { ...copy, id: newId(), diagrams: copy.diagrams.map(cloneDiagram), images: copy.images.map(cloneImage) };
}

export const cloneBlocks = (items: readonly Block[]): Block[] => items.map(cloneBlock);

/** A drill → a new block in a session (a copy, never a link – SPEC.md section 6). */
export function blockFromDrill(drill: Pick<Drill, 'title' | 'defaultDuration' | 'blockTypeId' | 'instructions' | 'material' | 'playersNeeded' | 'diagrams' | 'images'> & { id?: string }): Block {
  const block: Block = {
    id: newId(),
    kind: 'block',
    title: drill.title,
    duration: drill.defaultDuration,
    instructions: drill.instructions,
    diagrams: drill.diagrams.map(cloneDiagram),
    images: drill.images.map(cloneImage),
  };
  if (drill.blockTypeId) block.blockTypeId = drill.blockTypeId;
  if (drill.material) block.material = drill.material;
  if (drill.playersNeeded) block.playersNeeded = drill.playersNeeded;
  if (drill.id) block.sourceDrillId = drill.id;
  return block;
}

/** A block → drill content for the Library (a copy). */
export function drillContentFromBlock(block: Block): Omit<Drill, 'id' | 'teamId' | 'updatedAt'> {
  const content: Omit<Drill, 'id' | 'teamId' | 'updatedAt'> = {
    title: block.title,
    tags: [],
    defaultDuration: block.duration,
    instructions: block.instructions,
    diagrams: block.diagrams.map(cloneDiagram),
    images: block.images.map(cloneImage),
  };
  if (block.blockTypeId) content.blockTypeId = block.blockTypeId;
  if (block.material) content.material = block.material;
  if (block.playersNeeded) content.playersNeeded = block.playersNeeded;
  return content;
}

/** Image data ids used by sessions, drills or templates (for cleaning up unused photos). */
export function imageIdsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => imageIdsIn(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'localBlobId' && typeof v === 'string') out.add(v);
      else if (typeof v === 'object') imageIdsIn(v, out);
    }
  }
  return out;
}

export type { Session };
