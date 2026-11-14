import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { db } from '../../db/schema';
import { buildExport } from '../../exchange/export';
import type { ExportScope } from '../../exchange/format';
import { createShareLink, type ShareResult } from '../../exchange/shareLink';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { ui } from '../ui';

/**
 * "Dela länk" (SPEC.md section 7): the content is compressed into the link.
 * Opening the link shows the import preview and adds a copy.
 */
export default function ShareDialog({ scope, id, onClose }: { scope: Extract<ExportScope, 'session' | 'drill' | 'template' | 'season'>; id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [result, setResult] = useState<ShareResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void buildExport(db, scope, id).then((file) => setResult(createShareLink(`${window.location.origin}/`, file)));
  }, [scope, id]);

  async function copy() {
    if (!result?.ok) return;
    try {
      await navigator.clipboard.writeText(result.url);
      toast(t('share.copied'));
      onClose();
    } catch {
      // No clipboard access (e.g. not allowed): select the text so it can be copied by hand.
      input.current?.select();
    }
  }

  return (
    <Modal
      title={t('share.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.secondary} onClick={onClose}>
            {t('toast.close')}
          </button>
          <button type="button" className={ui.primary} disabled={!result?.ok} onClick={() => void copy()}>
            <Copy className="h-4 w-4" aria-hidden="true" /> {t('share.copy')}
          </button>
        </>
      }
    >
      {result?.ok === false && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          {t('share.tooLong')}
        </p>
      )}
      {result?.ok && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('share.info')}</p>
          {result.droppedPhotos && (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              {t('share.noPhotos')}
            </p>
          )}
          <label className="block">
            <span className={ui.label}>{t('share.link')}</span>
            <input ref={input} readOnly className={`${ui.input} mt-1 font-mono text-xs`} value={result.url} onFocus={(e) => e.target.select()} data-testid="share-link" />
          </label>
        </>
      )}
    </Modal>
  );
}
