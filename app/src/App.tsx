import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FileUp, Menu } from 'lucide-react';
import { db } from './db/schema';
import { ensureDefaults, purgeTrash } from './db/repository';
import { requestPersistentStorage, type PersistState } from './storage/persist';
import { useOnline } from './hooks/useOnline';
import { StartPage } from './pages/StartPage';
import { PwaPrompt } from './pwa/PwaPrompt';
import { ToastProvider } from './components/Toast';
import { AppMenu } from './components/menu/AppMenu';
import { ui } from './components/ui';

// Views other than the start page load on demand to keep the first load small (SPEC.md section 8).
// The service worker precaches them, so they also open offline.
const SessionPage = lazy(() => import('./pages/SessionPage').then((m) => ({ default: m.SessionPage })));
const SeasonPage = lazy(() => import('./pages/SeasonPage').then((m) => ({ default: m.SeasonPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const DrillPage = lazy(() => import('./pages/DrillPage').then((m) => ({ default: m.DrillPage })));

// A new key per id, so no state leaks between two sessions, seasons or drills.
function SessionRoute() {
  const { id } = useParams();
  return <SessionPage key={id} />;
}
function SeasonRoute() {
  const { id } = useParams();
  return <SeasonPage key={id} />;
}
function DrillRoute() {
  const { id } = useParams();
  return <DrillPage key={id} />;
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

const isJsonFile = (f: File) => f.type === 'application/json' || f.name.toLowerCase().endsWith('.json');

export default function App() {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    void ensureDefaults(db, (key) => i18n.t(key));
    void requestPersistentStorage().then(setPersist);
    // Items that have been in the trash for more than 30 days go for good.
    void purgeTrash(db);
  }, [i18n]);

  const nav = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-orange-50 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`;

  return (
    <BrowserRouter>
      <ToastProvider>
        <div
          className="flex min-h-dvh flex-col"
          // JSON files can be dropped anywhere to import them (SPEC.md section 8).
          onDragOver={(e) => {
            if ([...e.dataTransfer.items].some((i) => i.kind === 'file' && (i.type === 'application/json' || i.type === ''))) {
              e.preventDefault();
              setDropping(true);
            }
          }}
          onDragLeave={(e) => e.relatedTarget === null && setDropping(false)}
          onDrop={(e) => {
            setDropping(false);
            const file = [...e.dataTransfer.files].find(isJsonFile);
            if (!file) return;
            e.preventDefault();
            setImportFile(file);
          }}
        >
          <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
              <Link to="/" className="flex items-center gap-3">
                <img src="/favicon.svg" alt="" className="h-8 w-8" />
                <span>
                  <span className="block text-lg font-semibold leading-tight">{t('app.name')}</span>
                  <span className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">{t('app.tagline')}</span>
                </span>
              </Link>
              <nav aria-label={t('nav.main')} className="ml-2 flex flex-1 items-center gap-1">
                <NavLink to="/" end className={nav}>
                  {t('nav.start')}
                </NavLink>
                <NavLink to="/bibliotek" className={nav}>
                  {t('nav.library')}
                </NavLink>
              </nav>
              {!online && (
                <span role="status" className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                  {t('network.offline')}
                </span>
              )}
              <button type="button" className={ui.icon} onClick={() => setMenuOpen(true)} aria-label={t('nav.menu')} title={t('nav.menu')} aria-haspopup="dialog">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<StartPage />} />
                <Route path="/pass/:id" element={<SessionRoute />} />
                <Route path="/sasong/:id" element={<SeasonRoute />} />
                <Route path="/bibliotek" element={<LibraryPage />} />
                <Route path="/ovning/:id" element={<DrillRoute />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>

          <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-slate-500 dark:text-slate-400">
            <p>{t('storage.local')}</p>
            {persist === 'best-effort' && <p className="mt-1">{t('storage.notPersisted')}</p>}
          </footer>

          {dropping && (
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-orange-500/15 outline-4 -outline-offset-8 outline-dashed outline-orange-500">
              <p className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-lg font-medium shadow-lg dark:bg-slate-800">
                <FileUp className="h-5 w-5" aria-hidden="true" /> {t('import.dropAnywhere')}
              </p>
            </div>
          )}

          <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} importFile={importFile} onImportFileHandled={() => setImportFile(null)} />
          <PwaPrompt />
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
