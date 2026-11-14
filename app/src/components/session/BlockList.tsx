import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, BlockType } from '../../types/model';
import { calculateSchedule, type ScheduleRow } from '../../lib/schedule';
import { moveBlock } from '../../lib/blockOps';
import { BlockRow, type BlockPatch } from './BlockRow';

/** Data carried by an item dragged in from the Library panel. */
export interface LibraryDragData {
  library: true;
  title: string;
  /** Builds a fresh copy for the session. */
  make: () => Block;
}

export const LIST_END = 'list-end';
const isLibrary = (id: UniqueIdentifier | null) => typeof id === 'string' && id.startsWith('lib:');

interface Props {
  items: Block[];
  startTime: string;
  blockTypes: BlockType[];
  onMove: (fromId: string, toId: string) => void;
  onChange: (id: string, patch: BlockPatch, coalesceKey: string) => void;
  onDuration: (id: string, delta: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveToLibrary?: (id: string) => void;
  onSaveAsTemplate?: (id: string) => void;
  /** A Library item dropped on the list: insert before `beforeId`, or last. */
  onInsert?: (block: Block, beforeId: string | null) => void;
  /** Rendered next to the list, inside the same drag area (the Library panel). */
  sidePanel?: ReactNode;
  emptyText?: string;
}

// Library items only land where the pointer is; blocks use the closest position.
const collision: CollisionDetection = (args) => {
  if (isLibrary(args.active.id) && args.pointerCoordinates) return pointerWithin(args);
  return closestCenter(args);
};

/**
 * The ordered block list. Drag with mouse, finger or keyboard (dnd-kit);
 * clock times are recalculated live while dragging (SPEC.md section 8).
 */
export function BlockList({ items, startTime, blockTypes, onMove, onInsert, sidePanel, emptyText, ...handlers }: Props) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeLibrary, setActiveLibrary] = useState<LibraryDragData | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Times follow the block already while it is being dragged.
  const previewItems = useMemo(
    () => (activeId && overId && !isLibrary(activeId) && overId !== LIST_END ? moveBlock(items, String(activeId), String(overId)) : items),
    [items, activeId, overId],
  );
  const rows = useMemo(() => {
    const map = new Map<string, ScheduleRow>();
    for (const r of calculateSchedule(startTime, previewItems).rows) map.set(r.id, r);
    return map;
  }, [startTime, previewItems]);

  const titleOf = (id: UniqueIdentifier) => items.find((b) => b.id === id)?.title ?? activeLibrary?.title ?? '';
  const positionOf = (id: UniqueIdentifier) => (id === LIST_END ? items.length + 1 : items.findIndex((b) => b.id === id) + 1);
  const total = items.length + (activeLibrary ? 1 : 0);
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dnd.pickedUp', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) => (over ? t('dnd.movedOver', { title: titleOf(active.id), position: positionOf(over.id), total }) : undefined),
    onDragEnd: ({ active, over }) => (over ? t('dnd.dropped', { title: titleOf(active.id), position: positionOf(over.id), total }) : undefined),
    onDragCancel: ({ active }) => t('dnd.cancelled', { title: titleOf(active.id) }),
  };

  const reset = () => {
    setActiveId(null);
    setActiveLibrary(null);
    setOverId(null);
  };

  const active = activeId && !isLibrary(activeId) ? items.find((b) => b.id === activeId) : undefined;
  const insertingBefore = activeLibrary && overId ? String(overId) : null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('dnd.instructions') } }}
      onDragStart={(e: DragStartEvent) => {
        setActiveId(e.active.id);
        const data = e.active.data.current as LibraryDragData | undefined;
        if (data?.library) setActiveLibrary(data);
      }}
      onDragOver={(e: DragOverEvent) => setOverId(e.over?.id ?? null)}
      onDragEnd={(e: DragEndEvent) => {
        const data = e.active.data.current as LibraryDragData | undefined;
        if (data?.library) {
          if (e.over) onInsert?.(data.make(), e.over.id === LIST_END ? null : String(e.over.id));
        } else if (e.over && e.over.id !== LIST_END && e.active.id !== e.over.id) {
          onMove(String(e.active.id), String(e.over.id));
        }
        reset();
      }}
      onDragCancel={reset}
    >
      <div className={sidePanel ? 'flex flex-col gap-4 lg:flex-row lg:items-start' : undefined}>
        <div className="min-w-0 flex-1 space-y-2">
          <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2" data-testid="block-list">
              {items.map((block) => (
                <SortableItem
                  key={block.id}
                  insertLine={insertingBefore === block.id}
                  block={block}
                  row={rows.get(block.id)}
                  blockTypes={blockTypes}
                  expanded={expanded.has(block.id)}
                  onToggle={() => toggle(block.id)}
                  onChange={(patch, key) => handlers.onChange(block.id, patch, key)}
                  onDuration={(d) => handlers.onDuration(block.id, d)}
                  onDuplicate={() => handlers.onDuplicate(block.id)}
                  onDelete={() => handlers.onDelete(block.id)}
                  onSaveToLibrary={handlers.onSaveToLibrary ? () => handlers.onSaveToLibrary!(block.id) : undefined}
                  onSaveAsTemplate={handlers.onSaveAsTemplate ? () => handlers.onSaveAsTemplate!(block.id) : undefined}
                />
              ))}
            </ol>
          </SortableContext>
          <ListEnd active={!!activeLibrary} highlighted={insertingBefore === LIST_END} empty={items.length === 0} emptyText={emptyText} />
        </div>
        {sidePanel}
      </div>

      {/* The "shadow" that follows the pointer. */}
      <DragOverlay>
        {active ? (
          <div className="rotate-1 opacity-90 shadow-xl">
            <BlockRow block={active} row={rows.get(active.id)} blockTypes={blockTypes} expanded={false} onToggle={noop} onChange={noop} onDuration={noop} onDuplicate={noop} onDelete={noop} />
          </div>
        ) : activeLibrary ? (
          <div className="rotate-1 rounded-lg border-l-4 border-orange-500 bg-white px-3 py-2 text-sm font-medium shadow-xl dark:bg-slate-800">{activeLibrary.title}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const noop = () => {};

/** Drop target after the last block (and the empty state). */
function ListEnd({ active, highlighted, empty, emptyText }: { active: boolean; highlighted: boolean; empty: boolean; emptyText?: string }) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({ id: LIST_END });
  if (!empty && !active) return <div ref={setNodeRef} className="h-2" />;
  return (
    <div
      ref={setNodeRef}
      data-testid="list-end"
      className={`rounded-xl border border-dashed p-6 text-center text-sm ${highlighted ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-100' : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}
    >
      {active ? t('panel.dropHere') : emptyText}
    </div>
  );
}

function SortableItem({ insertLine, ...props }: React.ComponentProps<typeof BlockRow> & { insertLine: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.block.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className="relative">
      {/* Where a block will land: an orange line. */}
      {isDragging && <div data-testid="drop-indicator" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-orange-500" />}
      {insertLine && <div data-testid="drop-indicator" className="absolute inset-x-0 -top-1.5 h-1 rounded-full bg-orange-500" />}
      <div className={isDragging ? 'invisible' : undefined}>
        <BlockRow {...props} handleRef={setActivatorNodeRef} handleProps={{ ...attributes, ...listeners }} />
      </div>
    </li>
  );
}
