import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, Download, Heading, LayoutTemplate, Library, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { db } from '../db/schema';
import { createDrill, duplicateSession, listBlockTypes, listSeasons, moveToTrash, restoreFromTrash } from '../db/repository';
import { useSessionEditor } from '../hooks/useSessionEditor';
import { useUndoShortcuts } from '../hooks/useUndoShortcuts';
import { calculateSchedule } from '../lib/schedule';
import { changeDuration, duplicateBlock, insertBlock, insertBefore, moveBlock, newBlock, removeBlock, updateBlock } from '../lib/blockOps';
import { drillContentFromBlock } from '../lib/clone';
import { sessionContentOf } from '../templates/apply';
import { buildExport, downloadExport } from '../exchange/export';
import { LibraryPanel } from '../components/session/LibraryPanel';
import { SaveTemplateDialog } from '../components/templates/SaveTemplateDialog';
import { useToast } from '../components/Toast';
import { SessionHeader } from '../components/session/SessionHeader';
import { SessionSummary } from '../components/session/SessionSummary';
import { BlockList } from '../components/session/BlockList';
import { SaveStatus } from '../components/SaveStatus';
import { ui } from '../components/ui';
import type { Block, BlockType, Template } from '../types/model';

const BREAK_TYPE_ID = 'bt-break';

export function SessionPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editor = useSessionEditor(id);
  const { session, update } = editor;
  const blockTypes = useLiveQuery(() => listBlockTypes(db), []) ?? [];
  const seasons = useLiveQuery(() => listSeasons(db), []) ?? [];
  const typeMap = useMemo(() => new Map<string, BlockType>(blockTypes.map((bt) => [bt.id, bt])), [blockTypes]);
  const toast = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [saveTemplate, setSaveTemplate] = useState<{ kind: Template['kind']; name: string; content: () => Template['content'] } | null>(null);

  useUndoShortcuts(editor.undo, editor.redo);

  const setItems = useCallback(
    (change: (items: Block[]) => Block[], key: string | null = null) => update((s) => ({ ...s, items: change(s.items) }), key),
    [update],
  );

  if (editor.state === 'loading') return <p className="text-slate-500">{t('session.loading')}</p>;
  if (editor.state === 'missing' || !session) {
    return (
      <div className="space-y-4">
        <p>{t('session.notFound')}</p>
        <Link to="/" className={ui.secondary}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('app.home')}
        </Link>
      </div>
    );
  }

  const schedule = calculateSchedule(session.startTime, session.items);
  const backTo = session.seasonId ? `/sasong/${session.seasonId}` : '/';

  async function handleDuplicate() {
    await editor.flush();
    const copy = await duplicateSession(db, id, { title: t('session.copyTitle', { title: session!.title }) });
    if (copy) void navigate(`/pass/${copy.id}`);
  }

  async function handleDelete() {
    if (!window.confirm(t('session.confirmDelete', { title: session!.title }))) return;
    await editor.flush();
    await moveToTrash(db, 'session', id);
    toast(t('library.movedToTrash', { title: session!.title }), { label: t('toast.undo'), onClick: () => void restoreFromTrash(db, 'session', id) });
    void navigate(backTo, { replace: true });
  }

  async function handleExport() {
    await editor.flush();
    const file = await buildExport(db, 'session', id);
    toast(t('library.exported', { file: downloadExport(file, session!.title) }));
  }

  async function saveBlockToLibrary(blockId: string) {
    const block = session!.items.find((b) => b.id === blockId);
    if (!block) return;
    const drill = await createDrill(db, drillContentFromBlock(block));
    toast(t('drill.savedToLibrary', { title: drill.title }), { label: t('toast.open'), onClick: () => void navigate(`/ovning/${drill.id}`) });
  }

  function saveBlockAsTemplate(blockId: string) {
    const block = session!.items.find((b) => b.id === blockId);
    if (!block) return;
    setSaveTemplate({ kind: 'drill', name: block.title, content: () => ({ ...drillContentFromBlock(block), updatedAt: new Date().toISOString() }) });
  }

  const add = (block: Block) => setItems((items) => insertBlock(items, block));
  const addFromLibrary = (block: Block, beforeId: string | null = null) => {
    setItems((items) => insertBefore(items, block, beforeId));
    toast(t('panel.added', { title: block.title }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={backTo} className={ui.icon} aria-label={t('app.home')} title={t('app.home')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <SaveStatus state={editor.saveState} />
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={ui.icon} onClick={editor.undo} disabled={!editor.canUndo} aria-label={t('session.undo')} title={`${t('session.undo')} (Ctrl+Z)`}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={editor.redo} disabled={!editor.canRedo} aria-label={t('session.redo')} title={`${t('session.redo')} (Ctrl+Shift+Z)`}>
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => setSaveTemplate({ kind: 'session', name: session.title, content: () => sessionContentOf(session) })} aria-label={t('session.saveAsTemplate')} title={t('session.saveAsTemplate')}>
            <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => void handleExport()} aria-label={t('session.export')} title={t('session.export')}>
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => void handleDuplicate()} aria-label={t('session.duplicate')} title={t('session.duplicate')}>
            <Copy className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => void handleDelete()} aria-label={t('session.delete')} title={t('session.delete')}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section className={`${ui.card} space-y-5 p-4 sm:p-5`}>
        <SessionHeader session={session} seasons={seasons} onChange={(patch, key) => update((s) => ({ ...s, ...patch }), key)} />
        <SessionSummary schedule={schedule} items={session.items} blockTypes={typeMap} maxDuration={session.maxDuration} />
      </section>

      <section className="space-y-3">
        <BlockList
          items={session.items}
          startTime={session.startTime}
          blockTypes={blockTypes}
          emptyText={t('session.empty')}
          onMove={(from, to) => setItems((items) => moveBlock(items, from, to))}
          onChange={(blockId, patch, key) => setItems((items) => updateBlock(items, blockId, patch), key)}
          onDuration={(blockId, delta) => setItems((items) => changeDuration(items, blockId, delta))}
          onDuplicate={(blockId) => setItems((items) => duplicateBlock(items, blockId))}
          onDelete={(blockId) => setItems((items) => removeBlock(items, blockId))}
          onSaveToLibrary={(blockId) => void saveBlockToLibrary(blockId)}
          onSaveAsTemplate={saveBlockAsTemplate}
          onInsert={addFromLibrary}
          sidePanel={panelOpen ? <LibraryPanel blockTypes={blockTypes} onAdd={(b) => addFromLibrary(b)} onClose={() => setPanelOpen(false)} /> : undefined}
        />

        <div className="flex flex-wrap gap-2">
          <button type="button" className={ui.secondary} onClick={() => add(newBlock({ title: t('block.newDrill'), duration: 10 }))}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('block.addDrill')}
          </button>
          <button
            type="button"
            className={ui.secondary}
            onClick={() =>
              add(newBlock({ title: t('block.newBreak'), duration: 5, blockTypeId: typeMap.has(BREAK_TYPE_ID) ? BREAK_TYPE_ID : undefined }))
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('block.addBreak')}
          </button>
          <button type="button" className={ui.secondary} onClick={() => add(newBlock({ title: t('block.newSection'), kind: 'section' }))}>
            <Heading className="h-4 w-4" aria-hidden="true" /> {t('block.addSection')}
          </button>
          <button type="button" className={ui.secondary} aria-pressed={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
            <Library className="h-4 w-4" aria-hidden="true" /> {t('panel.open')}
          </button>
        </div>
      </section>

      {saveTemplate && <SaveTemplateDialog kind={saveTemplate.kind} defaultName={saveTemplate.name} content={saveTemplate.content} onClose={() => setSaveTemplate(null)} />}
    </div>
  );
}
