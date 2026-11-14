import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet } from 'lucide-react';
import { db } from '../../db/schema';
import { downloadBlob, sessionsToCsv, withExtension } from '../../exchange/csv';
import { exportFileName } from '../../exchange/format';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { ui } from '../ui';
import { loadTarget, type OutputTarget } from './target';
import { TargetPicker } from './TargetPicker';

/** "Exportera som kalkylark (CSV)" (SPEC.md section 7). */
export default function CsvDialog({ target: initial, onClose }: { target?: OutputTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [target, setTarget] = useState<OutputTarget | null>(initial ?? null);

  async function run() {
    if (!target) return;
    const data = await loadTarget(db, target);
    if (!data) return;
    const csv = sessionsToCsv(data.sessions, data.blockTypes, (k) => t(k), target.kind === 'season');
    const name = withExtension(exportFileName(data.title), 'csv');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
    toast(t('csvExport.done', { file: name }));
    onClose();
  }

  return (
    <Modal
      title={t('csvExport.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.secondary} onClick={onClose}>
            {t('templates.cancel')}
          </button>
          <button type="button" className={ui.primary} disabled={!target} onClick={() => void run()}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> {t('csvExport.submit')}
          </button>
        </>
      }
    >
      {!initial && <TargetPicker value={target} onChange={setTarget} />}
      <p className="text-sm text-slate-600 dark:text-slate-300">{t('csvExport.info')}</p>
    </Modal>
  );
}
