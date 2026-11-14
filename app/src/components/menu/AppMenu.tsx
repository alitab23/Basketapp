import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Download, Eraser, Upload, X } from 'lucide-react';
import { LANGUAGES } from '../../i18n';
import { db } from '../../db/schema';
import { clearAll } from '../../db/repository';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { ui } from '../ui';
import { ExportDialog } from './ExportDialog';
import { ImportDialog } from './ImportDialog';

type Dialog = 'export' | 'import' | 'clear' | null;

/**
 * The side menu (SPEC.md section 7). Step 4 adds export, import and "Rensa allt";
 * PDF and CSV come in step 5 and the other switches in step 8.
 */
export function AppMenu({ open, onClose, importFile, onImportFileHandled }: { open: boolean; onClose: () => void; importFile?: File | null; onImportFileHandled?: () => void }) {
  const { t, i18n } = useTranslation();
  const [dialog, setDialog] = useState<Dialog>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>('button')?.focus();
  }, [open]);

  useEffect(() => {
    if (importFile) setDialog('import');
  }, [importFile]);

  const openDialog = (d: Dialog) => {
    onClose();
    setDialog(d);
  };

  const item = 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700';

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/40" onClick={onClose}>
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={t('menu.title')}
            data-testid="app-menu"
            className="absolute inset-y-0 right-0 flex w-80 max-w-full flex-col bg-white shadow-xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          >
            <div className="flex items-center border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 className="flex-1 font-semibold">{t('menu.title')}</h2>
              <button type="button" onClick={onClose} aria-label={t('toast.close')} className={ui.icon}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-2">
              <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('menu.data')}</p>
              <button type="button" className={item} onClick={() => openDialog('export')}>
                <Download className="h-4 w-4" aria-hidden="true" /> {t('menu.export')}
              </button>
              <button type="button" className={item} onClick={() => openDialog('import')}>
                <Upload className="h-4 w-4" aria-hidden="true" /> {t('menu.import')}
              </button>
              <button type="button" className={`${item} text-red-700 dark:text-red-300`} onClick={() => openDialog('clear')}>
                <Eraser className="h-4 w-4" aria-hidden="true" /> {t('menu.clearAll')}
              </button>
            </nav>
            <div className="border-t border-slate-200 p-4 dark:border-slate-700">
              <label className="flex items-center gap-2 text-sm">
                {t('menu.language')}
                <select
                  value={i18n.language}
                  onChange={(e) => void i18n.changeLanguage(e.target.value)}
                  className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                >
                  {LANGUAGES.map((lng) => (
                    <option key={lng} value={lng}>
                      {t(`language.${lng}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      )}

      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
      {dialog === 'import' && (
        <ImportDialog
          initialFile={importFile ?? undefined}
          onClose={() => {
            setDialog(null);
            onImportFileHandled?.();
          }}
        />
      )}
      {dialog === 'clear' && <ClearAllDialog onClose={() => setDialog(null)} onExport={() => setDialog('export')} />}
    </>
  );
}

/** "Rensa allt": red, needs confirmation and first offers a JSON export (SPEC.md section 7). */
function ClearAllDialog({ onClose, onExport }: { onClose: () => void; onExport: () => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <Modal
      title={t('clearAll.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.secondary} onClick={onExport}>
            <Download className="h-4 w-4" aria-hidden="true" /> {t('clearAll.exportFirst')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            onClick={async () => {
              await clearAll(db, (k) => i18n.t(k));
              toast(t('clearAll.done'));
              onClose();
              void navigate('/');
            }}
          >
            <Eraser className="h-4 w-4" aria-hidden="true" /> {t('clearAll.confirm')}
          </button>
        </>
      }
    >
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-900/30 dark:text-red-100">{t('clearAll.warning')}</p>
    </Modal>
  );
}
