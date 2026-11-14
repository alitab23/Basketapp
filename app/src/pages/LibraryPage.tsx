import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Archive, ArchiveRestore, Copy, Download, LayoutTemplate, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { db } from '../db/schema';
import {
  createDrill,
  createSeason,
  createSession,
  deleteForever,
  duplicateSeason,
  duplicateSession,
  addDrill,
  listBlockTypes,
  listLibrary,
  listSeasonSessions,
  listTrash,
  moveSession,
  moveToTrash,
  purgeTrash,
  restoreFromTrash,
  setArchived,
  TRASH_DAYS,
  type LibraryKind,
} from '../db/repository';
import { allTags, filterEntries, type LibraryEntry, type SortBy } from '../lib/search';
import { drillEntries, seasonEntries, sessionEntries, templateEntries } from '../lib/libraryEntries';
import { formatRelative } from '../lib/time';
import { addDays, formatDate, todayISO } from '../lib/dates';
import { builtInTemplates } from '../templates/builtin';
import { drillContentOf, drillFromContent, seasonTemplateOf, sessionContentOf } from '../templates/apply';
import { buildExport, downloadExport } from '../exchange/export';
import { Duration } from '../components/Duration';
import { UseTemplateDialog } from '../components/templates/UseTemplateDialog';
import { SaveTemplateDialog } from '../components/templates/SaveTemplateDialog';
import { useToast } from '../components/Toast';
import { ui } from '../components/ui';
import type { Template } from '../types/model';

export const TABS = ['seasons', 'sessions', 'drills', 'templates', 'trash'] as const;
export type Tab = (typeof TABS)[number];

const KIND_OF_TAB: Record<Exclude<Tab, 'trash'>, LibraryKind> = { seasons: 'season', sessions: 'session', drills: 'drill', templates: 'template' };

/** The Library (SPEC.md section 6): everything saved, plus Templates and the trash. */
export function LibraryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'sessions';
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [tag, setTag] = useState('');
  const [blockTypeId, setBlockTypeId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [templateKind, setTemplateKind] = useState('');
  const [sort, setSort] = useState<SortBy>('updated');
  const [showArchived, setShowArchived] = useState(false);
  const [useTemplate, setUseTemplate] = useState<Template | null>(null);
  const [saveTemplate, setSaveTemplate] = useState<{ kind: Template['kind']; name: string; content: () => Promise<Template['content']> } | null>(null);

  const data = useLiveQuery(() => listLibrary(db), []);
  const blockTypes = useLiveQuery(() => listBlockTypes(db), []) ?? [];
  const builtIns = useMemo(() => builtInTemplates((k) => i18n.t(k)), [i18n.language, i18n]);
  const allTemplates = useMemo(() => [...builtIns, ...(data?.templates ?? [])], [builtIns, data?.templates]);
  const seasons = data?.seasons ?? [];

  const entries = useMemo<Record<Exclude<Tab, 'trash'>, LibraryEntry[]>>(
    () => ({
      seasons: seasonEntries(data?.seasons ?? [], data?.sessions ?? []),
      sessions: sessionEntries(data?.sessions ?? []),
      drills: drillEntries(data?.drills ?? []),
      templates: templateEntries(allTemplates),
    }),
    [data, allTemplates],
  );

  const tabEntries = tab === 'trash' ? [] : entries[tab];
  const results = useMemo(
    () => filterEntries(tabEntries, { query: deferredQuery, tag, blockTypeId, seasonId, templateKind, sort, showArchived }, i18n.language),
    [tabEntries, deferredQuery, tag, blockTypeId, seasonId, templateKind, sort, showArchived, i18n.language],
  );
  const tags = useMemo(() => allTags(tabEntries, i18n.language), [tabEntries, i18n.language]);

  const setTab = (next: Tab) => {
    setParams({ tab: next }, { replace: true });
    setTag('');
    setBlockTypeId('');
    setSeasonId('');
    setTemplateKind('');
  };

  // ---------- actions ----------

  async function create() {
    if (tab === 'seasons') {
      const s = await createSeason(db, { name: t('season.untitled'), startDate: todayISO(), endDate: addDays(todayISO(), 182) });
      void navigate(`/sasong/${s.id}`);
    } else if (tab === 'sessions') {
      const s = await createSession(db, { title: t('session.untitled'), date: todayISO() });
      void navigate(`/pass/${s.id}`);
    } else if (tab === 'drills') {
      const d = await createDrill(db, { title: t('drill.untitled') });
      void navigate(`/ovning/${d.id}`);
    }
  }

  async function duplicate(e: LibraryEntry) {
    const title = t('session.copyTitle', { title: e.title });
    if (e.kind === 'season') await duplicateSeason(db, e.id, title);
    if (e.kind === 'session') await duplicateSession(db, e.id, { title });
    if (e.kind === 'drill') {
      const original = data?.drills.find((d) => d.id === e.id);
      if (original) await addDrill(db, drillFromContent({ ...drillContentOf(original), title }));
    }
  }

  async function trash(e: LibraryEntry) {
    await moveToTrash(db, e.kind, e.id);
    toast(t('library.movedToTrash', { title: e.title }), { label: t('toast.undo'), onClick: () => void restoreFromTrash(db, e.kind, e.id) });
  }

  async function archive(e: LibraryEntry) {
    if (e.kind === 'template') return;
    await setArchived(db, e.kind, e.id, !e.archived);
    if (!e.archived) toast(t('library.archivedToast', { title: e.title }), { label: t('toast.undo'), onClick: () => void setArchived(db, e.kind as 'season', e.id, false) });
  }

  async function exportOne(e: LibraryEntry) {
    const builtIn = e.kind === 'template' ? builtIns.find((b) => b.id === e.id) : undefined;
    const file = await buildExport(db, e.kind, e.id, builtIn);
    toast(t('library.exported', { file: downloadExport(file, e.title) }));
  }

  function askSaveTemplate(e: LibraryEntry) {
    if (e.kind === 'season') {
      const season = seasons.find((s) => s.id === e.id)!;
      setSaveTemplate({ kind: 'season', name: e.title, content: async () => seasonTemplateOf(season, await listSeasonSessions(db, e.id)) });
    } else if (e.kind === 'session') {
      const s = data!.sessions.find((x) => x.id === e.id)!;
      setSaveTemplate({ kind: 'session', name: e.title, content: async () => sessionContentOf(s) });
    } else if (e.kind === 'drill') {
      const d = data!.drills.find((x) => x.id === e.id)!;
      setSaveTemplate({ kind: 'drill', name: e.title, content: async () => drillContentOf(d) });
    }
  }

  const href = (e: LibraryEntry) => ({ season: `/sasong/${e.id}`, session: `/pass/${e.id}`, drill: `/ovning/${e.id}`, template: '' })[e.kind];

  // ---------- render ----------

  const select = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">{t('library.title')}</h1>
        {(tab === 'seasons' || tab === 'sessions' || tab === 'drills') && (
          <button type="button" className={ui.primary} onClick={() => void create()}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t(`library.${tab === 'seasons' ? 'newSeason' : tab === 'sessions' ? 'newSession' : 'newDrill'}`)}
          </button>
        )}
      </div>

      <div role="tablist" aria-label={t('library.title')} className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === x ? 'border-orange-500 text-orange-700 dark:text-orange-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
          >
            {t(`library.tabs.${x}`)}
            {x !== 'trash' && <span className="ml-1.5 text-xs text-slate-400">{entries[x].filter((e) => showArchived || !e.archived).length}</span>}
          </button>
        ))}
      </div>

      {tab === 'trash' ? (
        <TrashList />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-56 flex-1">
              <span className="sr-only">{t('library.search')}</span>
              <input type="search" className={ui.input} placeholder={t('library.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {tags.length > 0 && (
              <select aria-label={t('library.allTags')} className={select} value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">{t('library.allTags')}</option>
                {tags.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            )}
            {tab !== 'seasons' && (
              <select aria-label={t('library.allBlockTypes')} className={select} value={blockTypeId} onChange={(e) => setBlockTypeId(e.target.value)}>
                <option value="">{t('library.allBlockTypes')}</option>
                {blockTypes.map((bt) => (
                  <option key={bt.id} value={bt.id}>
                    {bt.name}
                  </option>
                ))}
              </select>
            )}
            {tab === 'sessions' && (
              <select aria-label={t('library.allSeasons')} className={select} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
                <option value="">{t('library.allSeasons')}</option>
                <option value="none">{t('library.noSeason')}</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {tab === 'templates' && (
              <select aria-label={t('library.allKinds')} className={select} value={templateKind} onChange={(e) => setTemplateKind(e.target.value)}>
                <option value="">{t('library.allKinds')}</option>
                {(['season', 'session', 'drill'] as const).map((k) => (
                  <option key={k} value={k}>
                    {t(`templates.kind.${k}`)}
                  </option>
                ))}
              </select>
            )}
            <select aria-label={t('library.sort')} className={select} value={sort} onChange={(e) => setSort(e.target.value as SortBy)}>
              <option value="updated">{t('library.sortUpdated')}</option>
              <option value="name">{t('library.sortName')}</option>
            </select>
            {tab !== 'templates' && (
              <label className="flex items-center gap-1.5 py-1.5 text-sm">
                <input type="checkbox" className="accent-orange-500" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                {t('library.showArchived')}
              </label>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite" data-testid="result-count">
            {t('library.results', { count: results.length })}
          </p>

          {data === undefined ? null : results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {tabEntries.length === 0 ? t('library.empty') : t('library.noResults')}
            </p>
          ) : (
            <VirtualList
              items={results}
              render={(e) => (
                <LibraryCard
                  entry={e}
                  href={href(e)}
                  seasonName={e.seasonId ? seasons.find((s) => s.id === e.seasonId)?.name : undefined}
                  actions={
                    <>
                      {e.kind === 'template' ? (
                        <IconButton label={t('library.use')} onClick={() => setUseTemplate(allTemplates.find((x) => x.id === e.id)!)} primary>
                          <Play className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      ) : (
                        <IconButton label={t('library.duplicate')} onClick={() => void duplicate(e)}>
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      )}
                      {e.kind === 'session' && (
                        <select
                          aria-label={`${t('library.move')}: ${e.title}`}
                          className="max-w-36 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                          value={e.seasonId ?? ''}
                          onChange={async (ev) => {
                            const target = ev.target.value || null;
                            await moveSession(db, e.id, { seasonId: target });
                            toast(t('library.moved', { season: target ? seasons.find((s) => s.id === target)?.name : t('library.noSeason') }));
                          }}
                        >
                          <option value="">{t('library.noSeason')}</option>
                          {seasons.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {e.kind !== 'template' && (
                        <IconButton label={t('library.saveAsTemplate')} onClick={() => askSaveTemplate(e)}>
                          <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      )}
                      <IconButton label={t('library.exportJson')} onClick={() => void exportOne(e)}>
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                      {e.kind !== 'template' && (
                        <IconButton label={e.archived ? t('library.unarchive') : t('library.archive')} onClick={() => void archive(e)}>
                          {e.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
                        </IconButton>
                      )}
                      {!e.builtIn && (
                        <IconButton label={t('library.delete')} onClick={() => void trash(e)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      )}
                    </>
                  }
                />
              )}
            />
          )}
        </>
      )}

      {useTemplate && <UseTemplateDialog template={useTemplate} onClose={() => setUseTemplate(null)} />}
      {saveTemplate && <SaveTemplateDialog kind={saveTemplate.kind} defaultName={saveTemplate.name} content={saveTemplate.content} onClose={() => setSaveTemplate(null)} />}
    </div>
  );
}

function IconButton({ label, onClick, children, primary = false }: { label: string; onClick: () => void; children: ReactNode; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={primary ? `${ui.primary} px-2.5 py-1.5` : ui.icon}>
      {children}
      {primary && <span className="text-xs">{label}</span>}
    </button>
  );
}

/** Long lists are virtualised (SPEC.md section 8). */
function VirtualList({ items, render }: { items: LibraryEntry[]; render: (e: LibraryEntry) => ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 88,
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
    getItemKey: (i) => `${items[i]!.kind}:${items[i]!.id}`,
  });
  const rows = virtualizer.getVirtualItems();
  return (
    <ul ref={listRef} data-testid="library-list" className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {rows.map((row) => (
        <li
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          className="absolute inset-x-0 pb-2"
          style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
        >
          {render(items[row.index]!)}
        </li>
      ))}
    </ul>
  );
}

function LibraryCard({ entry: e, href, actions, seasonName }: { entry: LibraryEntry; href: string; actions: ReactNode; seasonName?: string }) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const meta: ReactNode[] = [];
  if (e.kind === 'template') meta.push(t(`templates.kind.${e.templateKind}`));
  if (e.date) meta.push(formatDate(e.date, i18n.language));
  if (e.kind === 'session' && seasonName) meta.push(seasonName);
  if (e.sessions !== undefined) meta.push(t('start.sessions', { count: e.sessions }));
  if (e.kind !== 'drill' && !(e.kind === 'template' && e.templateKind === 'drill')) meta.push(t('start.blocks', { count: e.blocks }));
  meta.push(<Duration key="d" minutes={e.minutes} />);
  if (e.updatedAt && !e.builtIn) meta.push(t('start.changed', { when: formatRelative(e.updatedAt, now, i18n.language) }));

  const title = href ? (
    <Link to={href} className="font-medium hover:text-orange-700 hover:underline dark:hover:text-orange-300">
      {e.title}
    </Link>
  ) : (
    <span className="font-medium">{e.title}</span>
  );

  return (
    <div className={`${ui.card} flex flex-wrap items-center gap-x-3 gap-y-2 p-3`} data-testid="library-card" data-kind={e.kind}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          {title}
          {e.builtIn && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">{t('library.builtIn')}</span>}
          {e.archived && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">{t('library.archived')}</span>}
        </p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {meta.map((m, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {m}
            </span>
          ))}
        </p>
        {e.tags.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-1">
            {e.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-800 dark:bg-orange-900/40 dark:text-orange-100">
                {tag}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">{actions}</div>
    </div>
  );
}

function TrashList() {
  const { t } = useTranslation();
  const toast = useToast();
  const items = useLiveQuery(() => listTrash(db), []);
  const now = Date.now();
  if (items === undefined) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-slate-500 dark:text-slate-400">{t('library.trash.info')}</p>
        {items.length > 0 && (
          <button
            type="button"
            className={`${ui.secondary} text-red-700 dark:text-red-300`}
            onClick={() => window.confirm(t('library.trash.confirmEmpty')) && void purgeTrash(db, { all: true })}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('library.trash.empty')}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">{t('library.trash.nothing')}</p>
      ) : (
        <ul className="space-y-2" data-testid="trash-list">
          {items.map((item) => {
            const daysLeft = Math.max(0, TRASH_DAYS - Math.floor((now - new Date(item.deletedAt).getTime()) / (24 * 3600 * 1000)));
            return (
              <li key={`${item.kind}:${item.id}`} className={`${ui.card} flex flex-wrap items-center gap-3 p-3`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(`library.kinds.${item.kind}`)} · {t('library.trash.daysLeft', { count: daysLeft })}
                  </p>
                </div>
                <button
                  type="button"
                  className={ui.secondary}
                  onClick={async () => {
                    await restoreFromTrash(db, item.kind, item.id);
                    toast(t('library.trash.restored', { title: item.title }));
                  }}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t('library.trash.restore')}
                </button>
                <button
                  type="button"
                  className={ui.icon}
                  aria-label={`${t('library.trash.deleteForever')}: ${item.title}`}
                  title={t('library.trash.deleteForever')}
                  onClick={() => window.confirm(t('library.trash.confirmDeleteForever', { title: item.title })) && void deleteForever(db, item.kind, item.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { KIND_OF_TAB };
