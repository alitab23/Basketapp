import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
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

interface Props {
  items: Block[];
  startTime: string;
  blockTypes: BlockType[];
  onMove: (fromId: string, toId: string) => void;
  onChange: (id: string, patch: BlockPatch, coalesceKey: string) => void;
  onDuration: (id: string, delta: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * The ordered block list. Drag with mouse, finger or keyboard (dnd-kit);
 * clock times are recalculated live while dragging (SPEC.md section 8).
 */
export function BlockList({ items, startTime, blockTypes, onMove, ...handlers }: Props) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Times follow the block already while it is being dragged.
  const previewItems = useMemo(
    () => (activeId && overId ? moveBlock(items, String(activeId), String(overId)) : items),
    [items, activeId, overId],
  );
  const rows = useMemo(() => {
    const map = new Map<string, ScheduleRow>();
    for (const r of calculateSchedule(startTime, previewItems).rows) map.set(r.id, r);
    return map;
  }, [startTime, previewItems]);

  const titleOf = (id: UniqueIdentifier) => items.find((b) => b.id === id)?.title ?? '';
  const positionOf = (id: UniqueIdentifier) => items.findIndex((b) => b.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dnd.pickedUp', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('dnd.movedOver', { title: titleOf(active.id), position: positionOf(over.id), total: items.length }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t('dnd.dropped', { title: titleOf(active.id), position: positionOf(over.id), total: items.length }) : undefined,
    onDragCancel: ({ active }) => t('dnd.cancelled', { title: titleOf(active.id) }),
  };

  const reset = () => {
    setActiveId(null);
    setOverId(null);
  };

  const active = activeId ? items.find((b) => b.id === activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('dnd.instructions') } }}
      onDragStart={(e: DragStartEvent) => setActiveId(e.active.id)}
      onDragOver={(e: DragOverEvent) => setOverId(e.over?.id ?? null)}
      onDragEnd={(e: DragEndEvent) => {
        if (e.over && e.active.id !== e.over.id) onMove(String(e.active.id), String(e.over.id));
        reset();
      }}
      onDragCancel={reset}
    >
      <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2" data-testid="block-list">
          {items.map((block) => (
            <SortableItem
              key={block.id}
              block={block}
              row={rows.get(block.id)}
              blockTypes={blockTypes}
              expanded={expanded.has(block.id)}
              onToggle={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(block.id)) next.add(block.id);
                  return next;
                })
              }
              onChange={(patch, key) => handlers.onChange(block.id, patch, key)}
              onDuration={(d) => handlers.onDuration(block.id, d)}
              onDuplicate={() => handlers.onDuplicate(block.id)}
              onDelete={() => handlers.onDelete(block.id)}
            />
          ))}
        </ol>
      </SortableContext>

      {/* The "shadow" that follows the pointer. */}
      <DragOverlay>
        {active ? (
          <div className="rotate-1 opacity-90 shadow-xl">
            <BlockRow
              block={active}
              row={rows.get(active.id)}
              blockTypes={blockTypes}
              expanded={false}
              onToggle={noop}
              onChange={noop}
              onDuration={noop}
              onDuplicate={noop}
              onDelete={noop}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const noop = () => {};

function SortableItem(props: React.ComponentProps<typeof BlockRow>) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.block.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'relative' : undefined}
    >
      {/* Where the block will land: an orange line instead of the row. */}
      {isDragging && <div data-testid="drop-indicator" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-orange-500" />}
      <div className={isDragging ? 'invisible' : undefined}>
        <BlockRow {...props} handleRef={setActivatorNodeRef} handleProps={{ ...attributes, ...listeners }} />
      </div>
    </li>
  );
}
