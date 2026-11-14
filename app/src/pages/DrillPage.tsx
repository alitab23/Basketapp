import { lazy, Suspense, useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, LayoutTemplate, Redo2, Undo2 } from 'lucide-react';
import { db } from '../db/schema';
import { listBlockTypes } from '../db/repository';
import { useDrillEditor } from '../hooks/useSessionEditor';
import { useUndoShortcuts } from '../hooks/useUndoShortcuts';
import { clampDuration } from '../lib/blockOps';
import { drillContentOf } from '../templates/apply';
import { SaveStatus } from '../components/SaveStatus';
import { SaveTemplateDialog, parseTags } from '../components/templates/SaveTemplateDialog';
import { ui } from '../components/ui';
import type { BlockPatch } from '../components/session/BlockRow';
import type { Block, Drill } from '../types/model';

const BlockDetails = lazy(() => import('../components/session/BlockDetails'));

/** A drill in the Library: same editing as a block in a session, plus tags and default length. */
export function DrillPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const fieldId = useId();
  const editor = useDrillEditor(id);
  const { drill, update } = editor;
  const blockTypes = useLiveQuery(() => listBlockTypes(db), []) ?? [];
  const [tagsText, setTagsText] = useState<string | null>(null);
  const [saveTemplate, setSaveTemplate] = useState(false);
  useUndoShortcuts(editor.undo, editor.redo);

  if (editor.state === 'loading') return <p className="text-slate-500">{t('drill.loading')}</p>;
  if (editor.state === 'missing' || !drill) {
    return (
      <div className="space-y-4">
        <p>{t('drill.notFound')}</p>
        <Link to="/bibliotek?tab=drills" className={ui.secondary}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('drill.back')}
        </Link>
      </div>
    );
  }

  const set = (patch: Partial<Drill>, key: string | null) => update((d) => ({ ...d, ...patch }), key);

  // The block editor works on a block; map it to the drill's fields.
  const asBlock: Block = {
    id: drill.id,
    kind: 'block',
    title: drill.title,
    duration: drill.defaultDuration,
    blockTypeId: drill.blockTypeId,
    instructions: drill.instructions,
    material: drill.material,
    playersNeeded: drill.playersNeeded,
    diagrams: drill.diagrams,
    images: drill.images,
  };
  const onBlockChange = (patch: BlockPatch, key: string) => {
    const { duration, ...rest } = patch;
    set({ ...rest, ...(duration !== undefined ? { defaultDuration: clampDuration(duration) } : {}) } as Partial<Drill>, key);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/bibliotek?tab=drills" className={ui.icon} aria-label={t('drill.back')} title={t('drill.back')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <SaveStatus state={editor.saveState} />
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={ui.icon} onClick={editor.undo} disabled={!editor.canUndo} aria-label={t('session.undo')} title={t('session.undo')}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={editor.redo} disabled={!editor.canRedo} aria-label={t('session.redo')} title={t('session.redo')}>
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => setSaveTemplate(true)} aria-label={t('library.saveAsTemplate')} title={t('library.saveAsTemplate')}>
            <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section className={`${ui.card} space-y-4 p-4 sm:p-5`}>
        <label className="sr-only" htmlFor={`${fieldId}-title`}>
          {t('drill.title')}
        </label>
        <input id={`${fieldId}-title`} className={`${ui.inline} text-2xl font-semibold`} value={drill.title} onChange={(e) => set({ title: e.target.value }, 'title')} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={ui.label} htmlFor={`${fieldId}-duration`}>
              {t('drill.defaultDuration')}
            </label>
            <input
              id={`${fieldId}-duration`}
              type="number"
              min={0}
              max={240}
              className={ui.input}
              value={drill.defaultDuration}
              onChange={(e) => set({ defaultDuration: clampDuration(e.target.valueAsNumber) }, 'duration')}
            />
          </div>
          <div>
            <label className={ui.label} htmlFor={`${fieldId}-type`}>
              {t('drill.type')}
            </label>
            <select id={`${fieldId}-type`} className={ui.input} value={drill.blockTypeId ?? ''} onChange={(e) => set({ blockTypeId: e.target.value || undefined }, 'type')}>
              <option value="">{t('block.noType')}</option>
              {blockTypes.map((bt) => (
                <option key={bt.id} value={bt.id}>
                  {bt.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={ui.label} htmlFor={`${fieldId}-tags`}>
              {t('drill.tags')}
            </label>
            <input
              id={`${fieldId}-tags`}
              className={ui.input}
              placeholder={t('drill.tagsHint')}
              value={tagsText ?? drill.tags.join(', ')}
              onChange={(e) => {
                setTagsText(e.target.value);
                set({ tags: parseTags(e.target.value) }, 'tags');
              }}
              onBlur={() => setTagsText(null)}
            />
          </div>
        </div>
      </section>

      <section className={`${ui.card} p-4 sm:p-5`}>
        <Suspense fallback={null}>
          <BlockDetails block={asBlock} onChange={onBlockChange} />
        </Suspense>
      </section>

      {saveTemplate && <SaveTemplateDialog kind="drill" defaultName={drill.title} content={() => drillContentOf(drill)} onClose={() => setSaveTemplate(false)} />}
    </div>
  );
}
