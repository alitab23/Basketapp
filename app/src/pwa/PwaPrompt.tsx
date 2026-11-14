import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';

/** Registers the service worker and shows "offline ready" / "new version" notices. */
export function PwaPrompt() {
  const { t } = useTranslation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg sm:inset-x-auto sm:right-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <span className="flex-1">{needRefresh ? t('pwa.updateAvailable') : t('pwa.offlineReady')}</span>
      {needRefresh && (
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="rounded-lg bg-orange-500 px-3 py-1.5 font-medium text-white hover:bg-orange-600"
        >
          {t('pwa.reload')}
        </button>
      )}
      <button
        type="button"
        onClick={close}
        className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        {t('pwa.close')}
      </button>
    </div>
  );
}
