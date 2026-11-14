import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Calendar, Copy, Download, FileSpreadsheet, FileText, LayoutTemplate, List, Plus, Trash2 } from 'lucide-react';
import { db } from '../db/schema';
import { createSession, duplicateSession, getSeason, listSeasonSessions, moveSession, moveToTrash, restoreFromTrash, updateSeason } from '../db/repository';
import { buildExport, downloadExport } from '../exchange/export';
import { seasonTemplateOf } from '../templates/apply';
import { SaveTemplateDialog } from '../components/templates/SaveTemplateDialog';
import { OutputDialog, type OutputKind } from '../components/output/OutputDialog';
import { useToast } from '../components/Toast';
import { calculateSchedule } from '../lib/schedule';
import { blockCount, totalMinutes } from '../lib/time';
import { formatDate, isWithin, monthOf, todayISO } from '../lib/dates';
import { SeasonCalendar } from '../components/season/SeasonCalendar';
import { Duration } from '../components/Duration';
import { ui } from '../components/ui';
import type { Season } from '../types/model';

type View = 'list' | 'calendar';

export function SeasonPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const season = useLiveQuery(async () => (await getSeason(db, id)) ?? null, [id]);
  const sessions = useLiveQuery(() => listSeasonSessions(db, id), [id]) ?? [];
  const [view, setView] = useState<View>('list');
  const [moved, setMoved] = useState<{ id: string; from?: string; to: string } | null>(null);
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [output, setOutput] = useState<OutputKind | null>(null);
  const toast = useToast();

  if (season === undefined) return null;
  if (season === null) {
    return (
      <div className="space-y-4">
        <p>{t('season.notFound')}</p>
        <Link to="/" className={ui.secondary}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('app.home')}
        </Link>
      </div>
    );
  }

  const total = sessions.reduce((sum, s) => sum + totalMinutes(s.items), 0);
  const today = todayISO();
  const defaultDate = isWithin(today, season.startDate, season.endDate) ? today : season.startDate;

  async function handleNewSession() {
    const s = await createSession(db, { title: t('session.untitled'), seasonId: id, date: defaultDate });
    void navigate(`/pass/${s.id}`);
  }

  async function handleMove(sessionId: string, date: string) {
    const from = sessions.find((s) => s.id === sessionId)?.date;
    await moveSession(db, sessionId, { date });
    setMoved({ id: sessionId, from, to: date });
  }

  async function handleExport() {
    const file = await buildExport(db, 'season', id);
    toast(t('library.exported', { file: downloadExport(file, season!.name) }));
  }

  async function handleDelete() {
    if (!window.confirm(t('season.confirmDelete', { name: season!.name }))) return;
    await moveToTrash(db, 'season', id);
    toast(t('library.movedToTrash', { title: season!.name }), { label: t('toast.undo'), onClick: () => void restoreFromTrash(db, 'season', id) });
    void navigate('/', { replace: true });
  }

  async function undoMove() {
    if (!moved) return;
    await moveSession(db, moved.id, { date: moved.from });
    setMoved(null);
  }

  const firstUpcoming = sessions.find((s) => s.date && s.date >= today)?.date;
  const initialMonth = monthOf(firstUpcoming ?? (isWithin(today, season.startDate, season.endDate) ? today : season.startDate));

  const tab = (v: View) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
      view === v ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1">
        <Link to="/" className={ui.icon} aria-label={t('app.home')} title={t('app.home')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={ui.icon} onClick={() => setSaveTemplate(true)} aria-label={t('season.saveAsTemplate')} title={t('season.saveAsTemplate')}>
            <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => setOutput('pdf')} aria-label={t('season.pdf')} title={t('season.pdf')}>
            <FileText className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => setOutput('csv')} aria-label={t('season.csv')} title={t('season.csv')}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => void handleExport()} aria-label={t('season.export')} title={t('season.export')}>
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} onClick={() => void handleDelete()} aria-label={t('season.delete')} title={t('season.delete')}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section className={`${ui.card} space-y-4 p-4 sm:p-5`}>
        <SeasonFields season={season} />
        <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{t('season.totalTime')}</span>
          <span data-testid="season-total" className="text-lg font-semibold">
            <Duration minutes={total} />
          </span>
          <span className="text-slate-500 dark:text-slate-400">{t('start.sessions', { count: sessions.length })}</span>
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ui.primary} onClick={() => void handleNewSession()}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('season.newSession')}
        </button>
        <div role="tablist" className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" role="tab" aria-selected={view === 'list'} className={tab('list')} onClick={() => setView('list')}>
            <List className="h-4 w-4" aria-hidden="true" /> {t('season.list')}
          </button>
          <button type="button" role="tab" aria-selected={view === 'calendar'} className={tab('calendar')} onClick={() => setView('calendar')}>
            <Calendar className="h-4 w-4" aria-hidden="true" /> {t('season.calendar')}
          </button>
        </div>
      </div>

      {moved && (
        <p role="status" className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          {t('dnd.movedSession', { date: formatDate(moved.to, i18n.language) })}
          <button type="button" className="font-medium text-orange-600 hover:underline" onClick={() => void undoMove()}>
            {t('session.undo')}
          </button>
        </p>
      )}

      {view === 'calendar' ? (
        <SeasonCalendar sessions={sessions} initialMonth={initialMonth} onMove={(sid, date) => void handleMove(sid, date)} />
      ) : sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t('season.empty')}
        </p>
      ) : (
        <SessionTable sessions={sessions} onDuplicate={async (sid, title) => {
          const copy = await duplicateSession(db, sid, { title: t('session.copyTitle', { title }) });
          if (copy) void navigate(`/pass/${copy.id}`);
        }} />
      )}

      <OutputDialog kind={output} target={{ kind: 'season', id }} onClose={() => setOutput(null)} />
      {saveTemplate && (
        <SaveTemplateDialog kind="season" defaultName={season.name} content={() => seasonTemplateOf(season, sessions)} onClose={() => setSaveTemplate(false)} />
      )}
    </div>
  );
}

function SessionTable({
  sessions,
  onDuplicate,
}: {
  sessions: Awaited<ReturnType<typeof listSeasonSessions>>;
  onDuplicate: (id: string, title: string) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="space-y-2" data-testid="season-sessions">
      {sessions.map((s) => {
        const schedule = calculateSchedule(s.startTime, s.items);
        return (
          <li key={s.id} className={`${ui.card} flex items-center gap-3 p-3`}>
            <Link to={`/pass/${s.id}`} className="min-w-0 flex-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {s.date ? formatDate(s.date, i18n.language) : t('season.noDate')} · {schedule.startLabel}–{schedule.endLabel}
              </p>
              <p className="truncate font-medium">{s.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('start.blocks', { count: blockCount(s.items) })} · <Duration minutes={schedule.total} />
              </p>
            </Link>
            <button type="button" className={ui.icon} onClick={() => onDuplicate(s.id, s.title)} aria-label={t('season.duplicate')} title={t('season.duplicate')}>
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Season fields keep a local draft so typing is never interrupted by the database round trip. */
function SeasonFields({ season }: { season: Season }) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState(season);
  const [dirty, setDirty] = useState(false);
  const pending = useRef<Season | null>(null);

  const save = (s: Season) => {
    const { name, startDate, endDate, description } = s;
    pending.current = null;
    return updateSeason(db, s.id, { name, startDate, endDate, description });
  };

  useEffect(() => {
    if (!dirty) return;
    pending.current = draft;
    const timer = setTimeout(() => {
      setDirty(false);
      void save(draft);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, dirty]);

  // Save a pending edit when leaving the page.
  useEffect(
    () => () => {
      if (pending.current) void save(pending.current);
    },
    [],
  );

  const set = (patch: Partial<Season>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  return (
    <div className="space-y-3">
      <label className="sr-only" htmlFor={`${id}-name`}>
        {t('season.name')}
      </label>
      <input id={`${id}-name`} className={`${ui.inline} text-2xl font-semibold`} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={ui.label} htmlFor={`${id}-start`}>
            {t('season.startDate')}
          </label>
          <input id={`${id}-start`} type="date" className={ui.input} value={draft.startDate} onChange={(e) => e.target.value && set({ startDate: e.target.value })} />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-end`}>
            {t('season.endDate')}
          </label>
          <input id={`${id}-end`} type="date" className={ui.input} value={draft.endDate} onChange={(e) => e.target.value && set({ endDate: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={ui.label} htmlFor={`${id}-description`}>
          {t('season.description')}
        </label>
        <textarea
          id={`${id}-description`}
          rows={2}
          className={ui.input}
          value={draft.description ?? ''}
          onChange={(e) => set({ description: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
