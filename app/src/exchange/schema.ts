import { z } from 'zod';

/**
 * Schema for import files (SPEC.md section 7). Unknown fields are dropped, so a
 * file can never put unexpected data into the database. Loaded only when importing.
 */

const point = z.object({ x: z.number(), y: z.number() });
const str = z.string();
const optStr = z.string().optional();

const pointElement = z.object({
  id: str,
  type: z.enum(['offense', 'defense', 'coach', 'ball', 'cone']),
  x: z.number(),
  y: z.number(),
  label: optStr,
  color: optStr,
  rotation: z.number().optional(),
  attachedTo: optStr,
});
const lineElement = z.object({
  id: str,
  type: z.enum(['pass', 'dribble', 'cut', 'screen', 'handoff', 'shot', 'slide']),
  points: z.array(point).min(2),
  curved: z.boolean(),
  fromElementId: optStr,
  order: z.number().optional(),
  color: optStr,
});
const textElement = z.object({ id: str, type: z.literal('text'), x: z.number(), y: z.number(), text: str, size: z.number() });
const zoneElement = z.object({ id: str, type: z.literal('zone'), shape: z.enum(['rect', 'ellipse']), x: z.number(), y: z.number(), w: z.number(), h: z.number(), color: str });
const freehandElement = z.object({ id: str, type: z.literal('freehand'), points: z.array(point), color: str });

export const courtElement = z.union([pointElement, lineElement, textElement, zoneElement, freehandElement]);

export const diagram = z.object({ id: str, court: z.enum(['half', 'full']), caption: optStr, elements: z.array(courtElement) });

export const imageAttachment = z.object({
  id: str,
  fileName: str,
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  width: z.number(),
  height: z.number(),
  caption: optStr,
  localBlobId: optStr,
  url: optStr,
});

export const block = z.object({
  id: str,
  kind: z.enum(['block', 'section']),
  title: str,
  duration: z.number().min(0).max(240),
  blockTypeId: optStr,
  instructions: str,
  material: optStr,
  playersNeeded: optStr,
  diagrams: z.array(diagram),
  images: z.array(imageAttachment),
  sourceDrillId: optStr,
});

const teamId = z.string().nullable();

export const blockType = z.object({ id: str, teamId, name: str, icon: str, color: str });

export const season = z.object({
  id: str,
  teamId,
  name: str,
  startDate: str,
  endDate: str,
  description: optStr,
  archived: z.boolean(),
  deletedAt: optStr,
  updatedAt: str,
});

const sessionFields = {
  title: str,
  date: optStr,
  startTime: str,
  location: optStr,
  participants: z.number().optional(),
  coach: optStr,
  focus: optStr,
  description: optStr,
  maxDuration: z.number().optional(),
  items: z.array(block),
  fromTemplateId: optStr,
  archived: z.boolean().optional(),
  deletedAt: optStr,
  updatedAt: str,
  updatedBy: optStr,
};

export const session = z.object({ id: str, teamId, seasonId: z.string().nullable(), ...sessionFields });
export const sessionContent = z.object(sessionFields);

const drillFields = {
  title: str,
  tags: z.array(str),
  defaultDuration: z.number().min(0).max(240),
  blockTypeId: optStr,
  instructions: str,
  material: optStr,
  playersNeeded: optStr,
  diagrams: z.array(diagram),
  images: z.array(imageAttachment),
  archived: z.boolean().optional(),
  deletedAt: optStr,
  updatedAt: str,
};

export const drill = z.object({ id: str, teamId, ...drillFields });
export const drillContent = z.object(drillFields);

export const seasonTemplate = z.object({ name: str, weeks: z.number().int().min(1), sessionsPerWeek: z.number().int().min(1), sessions: z.array(sessionContent) });

const templateBase = { id: str, teamId, builtIn: z.boolean(), name: str, description: optStr, tags: z.array(str), deletedAt: optStr, updatedAt: optStr };

export const template = z.discriminatedUnion('kind', [
  z.object({ ...templateBase, kind: z.literal('season'), content: seasonTemplate }),
  z.object({ ...templateBase, kind: z.literal('session'), content: sessionContent }),
  z.object({ ...templateBase, kind: z.literal('drill'), content: drillContent }),
]);

export const exportImage = z.object({ id: str, mime: str, data: str });

export const exportFileV1 = z.object({
  format: z.literal('basketapp'),
  version: z.literal(1),
  exportedAt: str,
  scope: z.enum(['all', 'library', 'templates', 'season', 'session', 'drill', 'template']),
  blockTypes: z.array(blockType).default([]),
  seasons: z.array(season).default([]),
  sessions: z.array(session).default([]),
  drills: z.array(drill).default([]),
  templates: z.array(template).default([]),
  images: z.array(exportImage).default([]),
});
