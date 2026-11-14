import { useDeferredValue, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Plus, X } from 'lucide-react';
import { db } from '../../db/schema';
import { listDrills, listOwnTemplates } from '../../db/repository';
import { blockFromDrill } from '../../lib/clone';
import { builtInTemplates } from '../../templates/builtin';
import { isDrillTemplate } from '../../templates/apply';
import type { Block, BlockType } from '../../types/model';
import { BlockTypeIcon } from '../BlockTypeIcon';
import { Duration } from '../Duration';
import { ui } from '../ui';
import type { LibraryDragData } from './BlockList';

interface PanelItem {
  key: string;
  title: string;
  minutes: number;
  blockTypeId?: string;
  text: string;
  make: () => Block;
}

/**
 * The Library as a side panel in the session view (SPEC.md section 6).
 * Items go in as copies, so changes in the session never touch the Library.
 */
export function LibraryPanel({ blockTypes, onAdd, onClose }: { blockTypes: BlockType[]; onAdd: (block: Block) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.toLowerCase());
  const drills = useLiveQuery(() => listDrills(db), []) ?? [];
  const own = useLiveQuery(() => listOwnTemplates(db), []) ?? [];
  const builtIns = useMemo(() => builtInTemplates((k) => i18n.t(k)), [i18n, i18n.language]);

  const drillItems: PanelItem[] = drills.map((d) => ({
    key: `lib:drill:${d.id}`,
    title: d.title,
    minutes: d.defaultDuration,
    blockTypeId: d.blockTypeId,
    text: `${d.title} ${d.tags.join(' ')} ${d.instructions}`.toLowerCase(),
    make: () => blockFromDrill(d),
  }));
  const templateItems: PanelItem[] = [...own, ...builtIns].filter(isDrillTemplate).map((tpl) => ({
    key: `lib:template:${tpl.id}`,
    title: tpl.name,
    minutes: tpl.content.defaultDuration,
    blockTypeId: tpl.content.blockTypeId,
    text: `${tpl.name} ${tpl.tags.join(' ')} ${tpl.description ?? ''}`.toLowerCase(),
    make: () => blockFromDrill(tpl.content),
  }));
  const match = (i: PanelItem) => q.split(/\s+/).every((w) => i.text.includes(w));

  return (
    <aside aria-label={t('panel.title')} data-testid="library-panel" className={`${ui.card} w-full shrink-0 space-y-3 p-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:w-80 lg:overflow-y-auto`}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-semibold">{t('panel.title')}</h2>
        <button type="button" className={ui.icon} onClick={onClose} aria-label={t('panel.close')} title={t('panel.close')}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <input type="search" className={ui.input} placeholder={t('panel.search')} aria-label={t('panel.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('panel.dragHint')}</p>
      {[
        { title: t('panel.drills'), items: drillItems.filter(match) },
        { title: t('panel.templates'), items: templateItems.filter(match) },
      ].map((group) => (
        <section key={group.title} className="space-y-1.5">
          <h3 className={ui.sectionHeading}>{group.title}</h3>
          {group.items.length === 0 ? (
            <p className="text-xs text-slate-500">{t('panel.empty')}</p>
          ) : (
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <PanelRow key={item.key} item={item} type={blockTypes.find((bt) => bt.id === item.blockTypeId)} onAdd={() => onAdd(item.make())} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </aside>
  );
}

function PanelRow({ item, type, onAdd }: { item: PanelItem; type?: BlockType; onAdd: () => void }) {
  const { t } = useTranslation();
  const data: LibraryDragData = { library: true, title: item.title, make: item.make };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: item.key, data });
  return (
    <li ref={setNodeRef} data-testid="panel-item" className={`flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 ${isDragging ? 'opacity-40' : ''}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('block.dragHandle', { title: item.title })}
        className={`${ui.icon} h-7 w-7 shrink-0 cursor-grab touch-none`}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: type?.color ?? '#94A3B8' }}>
        <BlockTypeIcon icon={type?.icon} className="h-3 w-3" />
      </span>
      <span className="min-w-0 flex-1 truncate" title={item.title}>
        {item.title}
      </span>
      <span className="shrink-0 text-xs text-slate-500">
        <Duration minutes={item.minutes} />
      </span>
      <button type="button" className={`${ui.icon} h-7 w-7`} onClick={onAdd} aria-label={`${t('panel.add')}: ${item.title}`} title={t('panel.add')}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}
