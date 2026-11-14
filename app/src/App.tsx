import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './i18n';
import { db } from './db/schema';
import { ensureDefaults } from './db/repository';
import { requestPersistentStorage, type PersistState } from './storage/persist';
import { useOnline } from './hooks/useOnline';
import { StartPage } from './pages/StartPage';
import { PwaPrompt } from './pwa/PwaPrompt';

export default function App() {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const [persist, setPersist] = useState<PersistState | null>(null);

  useEffect(() => {
    void ensureDefaults(db, (key) => i18n.t(key));
    void requestPersistentStorage().then(setPersist);
  }, [i18n]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-tight">{t('app.name')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('app.tagline')}</p>
          </div>
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
        <StartPage />
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-slate-500 dark:text-slate-400">
        <p>{t('storage.local')}</p>
        {persist === 'best-effort' && <p className="mt-1">{t('storage.notPersisted')}</p>}
      </footer>

      <PwaPrompt />
    </div>
  );
}
