import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/schema';
import { createSession, listRecentSessions } from '../db/repository';
import { blockCount, formatRelative, totalMinutes } from '../lib/time';
import { Duration } from '../components/Duration';

export function StartPage() {
  const { t, i18n } = useTranslation();
  const sessions = useLiveQuery(() => listRecentSessions(db), []);
  const [notice, setNotice] = useState(false);
  const now = new Date();

  async function handleNewSession() {
    await createSession(db, { title: t('session.untitled') });
    // The session view is built in step 2 of SPEC.md section 10.
    setNotice(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleNewSession()}
          className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white shadow-sm hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
        >
          + {t('start.newSession')}
        </button>
        {notice && <span className="text-sm text-slate-500 dark:text-slate-400">{t('start.comingSoon')}</span>}
      </div>

      <section aria-labelledby="recent-heading" className="space-y-3">
        <h2 id="recent-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('start.recentSessions')}
        </h2>

        {sessions === undefined ? null : sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('start.empty')}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="session-list">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('start.blocks', { count: blockCount(s.items) })} · <Duration minutes={totalMinutes(s.items)} /> ·{' '}
                  {t('start.changed', { when: formatRelative(s.updatedAt, now, i18n.language) })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
