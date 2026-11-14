import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { db } from '../db/schema';
import { createSeason, createSession, listAllSessions, listSeasons } from '../db/repository';
import { blockCount, formatRelative, totalMinutes } from '../lib/time';
import { addDays, todayISO } from '../lib/dates';
import { Duration } from '../components/Duration';
import { ui } from '../components/ui';

const RECENT_LIMIT = 12;

export function StartPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const sessions = useLiveQuery(() => listAllSessions(db), []);
  const seasons = useLiveQuery(() => listSeasons(db), []);
  const now = new Date();

  async function handleNewSession() {
    const s = await createSession(db, { title: t('session.untitled'), date: todayISO() });
    void navigate(`/pass/${s.id}`);
  }

  async function handleNewSeason() {
    const start = todayISO();
    const season = await createSeason(db, { name: t('season.untitled'), startDate: start, endDate: addDays(start, 182) });
    void navigate(`/sasong/${season.id}`);
  }

  const recent = sessions?.slice(0, RECENT_LIMIT);
  const perSeason = new Map<string, { count: number; minutes: number }>();
  for (const s of sessions ?? []) {
    if (!s.seasonId) continue;
    const agg = perSeason.get(s.seasonId) ?? { count: 0, minutes: 0 };
    agg.count += 1;
    agg.minutes += totalMinutes(s.items);
    perSeason.set(s.seasonId, agg);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void handleNewSession()} className={ui.primary}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('start.newSession')}
        </button>
        <button type="button" onClick={() => void handleNewSeason()} className={ui.secondary}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('start.newSeason')}
        </button>
      </div>

      <section aria-labelledby="recent-heading" className="space-y-3">
        <h2 id="recent-heading" className={ui.sectionHeading}>
          {t('start.recentSessions')}
        </h2>
        {recent === undefined ? null : recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('start.empty')}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="session-list">
            {recent.map((s) => (
              <li key={s.id}>
                <Link to={`/pass/${s.id}`} className={`${ui.card} block p-4 hover:border-orange-400`}>
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {t('start.blocks', { count: blockCount(s.items) })} · <Duration minutes={totalMinutes(s.items)} /> ·{' '}
                    {t('start.changed', { when: formatRelative(s.updatedAt, now, i18n.language) })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="seasons-heading" className="space-y-3">
        <h2 id="seasons-heading" className={ui.sectionHeading}>
          {t('start.seasons')}
        </h2>
        {seasons === undefined ? null : seasons.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('start.noSeasons')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="season-list">
            {seasons.map((season) => {
              const agg = perSeason.get(season.id) ?? { count: 0, minutes: 0 };
              return (
                <li key={season.id}>
                  <Link to={`/sasong/${season.id}`} className={`${ui.card} block p-4 hover:border-orange-400`}>
                    <p className="font-medium">{season.name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {t('start.sessions', { count: agg.count })} · <Duration minutes={agg.minutes} /> ·{' '}
                      {t('start.changed', { when: formatRelative(season.updatedAt, now, i18n.language) })}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
