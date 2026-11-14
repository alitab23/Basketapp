import { lazy, Suspense, type HTMLAttributes, type Ref } from 'react';
import { ChevronDown, ChevronRight, Copy, GripVertical, Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Block, BlockType } from '../../types/model';
import type { ScheduleRow } from '../../lib/schedule';
import { MAX_DURATION } from '../../lib/blockOps';
import { markdownExcerpt } from '../../lib/text';
import { BlockTypeIcon } from '../BlockTypeIcon';
import { Duration } from '../Duration';
import { ui } from '../ui';

// Markdown editor and renderer load only when a block is opened (SPEC.md section 8).
const BlockDetails = lazy(() => import('./BlockDetails'));

export type BlockPatch = Partial<Omit<Block, 'id' | 'kind'>>;

export interface BlockRowProps {
  block: Block;
  row: ScheduleRow | undefined;
  blockTypes: BlockType[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: BlockPatch, coalesceKey: string) => void;
  onDuration: (delta: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Spread onto the drag handle (from dnd-kit). */
  handleProps?: HTMLAttributes<HTMLButtonElement>;
  handleRef?: Ref<HTMLButtonElement>;
}

export function BlockRow(props: BlockRowProps) {
  return props.block.kind === 'section' ? <SectionRow {...props} /> : <DrillRow {...props} />;
}

function DragHandle({ title, handleProps, handleRef }: Pick<BlockRowProps, 'handleProps' | 'handleRef'> & { title: string }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      ref={handleRef}
      {...handleProps}
      aria-label={t('block.dragHandle', { title })}
      data-testid="drag-handle"
      className={`${ui.icon} shrink-0 cursor-grab touch-none active:cursor-grabbing`}
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function RowActions({ onDuplicate, onDelete }: Pick<BlockRowProps, 'onDuplicate' | 'onDelete'>) {
  const { t } = useTranslation();
  return (
    <>
      <button type="button" className={ui.icon} onClick={onDuplicate} aria-label={t('block.duplicate')} title={t('block.duplicate')}>
        <Copy className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" className={ui.icon} onClick={onDelete} aria-label={t('block.delete')} title={t('block.delete')}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );
}

function SectionRow({ block, row, onChange, ...rest }: BlockRowProps) {
  const { t } = useTranslation();
  return (
    <div data-testid="section-row" className="flex items-center gap-2 border-b-2 border-slate-300 pb-1 pt-4 dark:border-slate-600">
      <DragHandle title={block.title} handleProps={rest.handleProps} handleRef={rest.handleRef} />
      <input
        aria-label={t('block.title')}
        className={`${ui.inline} flex-1 text-sm font-semibold uppercase tracking-wide`}
        value={block.title}
        onChange={(e) => onChange({ title: e.target.value }, `title:${block.id}`)}
      />
      <span data-testid="section-total" className="whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
        <Duration minutes={row?.sectionMinutes ?? 0} />
      </span>
      <RowActions onDuplicate={rest.onDuplicate} onDelete={rest.onDelete} />
    </div>
  );
}

function DrillRow({ block, row, blockTypes, expanded, onToggle, onChange, onDuration, ...rest }: BlockRowProps) {
  const { t } = useTranslation();
  const type = blockTypes.find((bt) => bt.id === block.blockTypeId);
  const excerpt = markdownExcerpt(block.instructions);
  const detailsId = `details-${block.id}`;

  return (
    <div
      data-testid="block-row"
      className={`${ui.card} border-l-4`}
      style={{ borderLeftColor: type?.color ?? '#CBD5E1' }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2">
        <DragHandle title={block.title} handleProps={rest.handleProps} handleRef={rest.handleRef} />

        <span data-testid="block-time" className="w-24 shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">
          {row ? t('block.time', { start: row.startLabel, end: row.endLabel }) : null}
        </span>

        <input
          aria-label={t('block.title')}
          className={`${ui.inline} min-w-40 flex-1 font-medium`}
          value={block.title}
          onChange={(e) => onChange({ title: e.target.value }, `title:${block.id}`)}
        />

        <label className="flex items-center gap-1.5">
          <span className="sr-only">{t('block.type')}</span>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-white"
            style={{ background: type?.color ?? '#94A3B8' }}
          >
            <BlockTypeIcon icon={type?.icon} />
          </span>
          <select
            className="max-w-44 rounded-md border border-slate-300 bg-white py-1 pl-1.5 pr-6 text-xs dark:border-slate-700 dark:bg-slate-900"
            value={block.blockTypeId ?? ''}
            onChange={(e) => onChange({ blockTypeId: e.target.value || undefined }, `type:${block.id}`)}
          >
            <option value="">{t('block.noType')}</option>
            {blockTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {bt.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center">
          <button type="button" className={ui.icon} onClick={() => onDuration(-5)} aria-label={t('block.minus5')}>
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            type="number"
            min={0}
            max={MAX_DURATION}
            inputMode="numeric"
            aria-label={t('block.duration')}
            data-testid="block-duration"
            className="w-14 rounded-md border border-slate-300 bg-white px-1 py-1 text-center text-sm tabular-nums dark:border-slate-700 dark:bg-slate-900"
            value={block.duration}
            onChange={(e) => {
              const n = e.target.valueAsNumber;
              onChange({ duration: Number.isFinite(n) ? n : 0 }, `duration:${block.id}`);
            }}
          />
          <button type="button" className={ui.icon} onClick={() => onDuration(5)} aria-label={t('block.plus5')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="ml-auto flex items-center">
          <button
            type="button"
            className={ui.icon}
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={expanded ? t('block.collapse') : t('block.expand')}
            title={expanded ? t('block.collapse') : t('block.expand')}
          >
            {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
          <RowActions onDuplicate={rest.onDuplicate} onDelete={rest.onDelete} />
        </div>
      </div>

      {!expanded && excerpt && (
        <p className="line-clamp-2 px-3 pb-2 pl-12 text-sm text-slate-500 dark:text-slate-400">{excerpt}</p>
      )}

      {expanded && (
        <div id={detailsId} className="border-t border-slate-200 p-3 dark:border-slate-700">
          <Suspense fallback={null}>
            <BlockDetails block={block} onChange={onChange} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
