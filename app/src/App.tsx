import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './i18n';
import { db } from './db/schema';
import { ensureDefaults } from './db/repository';
import { requestPersistentStorage, type PersistState } from './storage/persist';
import { useOnline } from './hooks/useOnline';
import { StartPage } from './pages/StartPage';
import { PwaPrompt } from './pwa/PwaPrompt';

// Session and season views load on demand to keep the first load small (SPEC.md section 8).
// The service worker precaches them, so they also open offline.
const SessionPage = lazy(() => import('./pages/SessionPage').then((m) => ({ default: m.SessionPage })));
const SeasonPage = lazy(() => import('./pages/SeasonPage').then((m) => ({ default: m.SeasonPage })));

// A new key per id, so no state leaks between two sessions or seasons.
function SessionRoute() {
  const { id } = useParams();
  return <SessionPage key={id} />;
}
function SeasonRoute() {
  const { id } = useParams();
  return <SeasonPage key={id} />;
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <p>
      {t('notFound.title')}{' '}
      <Link to="/" className="text-orange-600 hover:underline">
        {t('app.home')}
      </Link>
    </p>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const [persist, setPersist] = useState<PersistState | null>(null);

  useEffect(() => {
    void ensureDefaults(db, (key) => i18n.t(key));
    void requestPersistentStorage().then(setPersist);
  }, [i18n]);

  return (
    <BrowserRouter>
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link to="/" className="flex flex-1 items-center gap-3">
              <img src="/favicon.svg" alt="" className="h-8 w-8" />
              <span>
                <span className="block text-lg font-semibold leading-tight">{t('app.name')}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t('app.tagline')}</span>
              </span>
            </Link>
            {!online && (
              <span
                role="status"
                className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
              >
                {t('network.offline')}
              </span>
            )}
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">{t('language.label')}</span>
              <select
                value={i18n.language}
                onChange={(e) => void i18n.changeLanguage(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
              >
                {LANGUAGES.map((lng) => (
                  <option key={lng} value={lng}>
                    {t(`language.${lng}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<StartPage />} />
              <Route path="/pass/:id" element={<SessionRoute />} />
              <Route path="/sasong/:id" element={<SeasonRoute />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-slate-500 dark:text-slate-400">
          <p>{t('storage.local')}</p>
          {persist === 'best-effort' && <p className="mt-1">{t('storage.notPersisted')}</p>}
        </footer>

        <PwaPrompt />
      </div>
    </BrowserRouter>
  );
}
