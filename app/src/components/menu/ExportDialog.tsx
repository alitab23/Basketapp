import { useId, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/schema';
import { listAllSessions, listSeasons } from '../../db/repository';
import { buildExport, downloadExport, isEmptyExport } from '../../exchange/export';
import type { ExportScope } from '../../exchange/format';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { ui } from '../ui';

type Choice = Extract<ExportScope, 'all' | 'library' | 'templates' | 'season' | 'session'>;

/** "Exportera data": the scope is chosen in a dialog (SPEC.md section 7). */
export function ExportDialog({ onClose, initial = 'all' }: { onClose: () => void; initial?: Choice }) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [scope, setScope] = useState<Choice>(initial);
  const [seasonId, setSeasonId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const seasons = useLiveQuery(() => listSeasons(db), []) ?? [];
  const sessions = useLiveQuery(() => listAllSessions(db), []) ?? [];

  async function run() {
    const targetId = scope === 'season' ? seasonId : scope === 'session' ? sessionId : undefined;
    const file = await buildExport(db, scope, targetId);
    if (isEmptyExport(file)) return setError(t('export.nothing'));
    const title =
      scope === 'season'
        ? (seasons.find((s) => s.id === seasonId)?.name ?? '')
        : scope === 'session'
          ? (sessions.find((s) => s.id === sessionId)?.title ?? '')
          : t(`export.${scope}Title`);
    toast(t('library.exported', { file: downloadExport(file, title) }));
    onClose();
  }

  const options: { value: Choice; label: string }[] = [
    { value: 'all', label: t('export.all') },
    { value: 'library', label: t('export.library') },
    { value: 'templates', label: t('export.templates') },
    { value: 'season', label: t('export.season') },
    { value: 'session', label: t('export.session') },
  ];
  const disabled = (scope === 'season' && !seasonId) || (scope === 'session' && !sessionId);

  return (
    <Modal
      title={t('export.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.secondary} onClick={onClose}>
            {t('templates.cancel')}
          </button>
          <button type="button" className={ui.primary} disabled={disabled} onClick={() => void run()}>
            {t('export.submit')}
          </button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t('export.scope')}</legend>
        {options.map((o) => (
          <div key={o.value} className="space-y-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name={`${id}-scope`} className="accent-orange-500" checked={scope === o.value} onChange={() => setScope(o.value)} />
              {o.label}
            </label>
            {scope === 'season' && o.value === 'season' && (
              <select aria-label={t('export.season')} className={`${ui.input} ml-6 w-auto`} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
                <option value="">{t('export.choose')}</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {scope === 'session' && o.value === 'session' && (
              <select aria-label={t('export.session')} className={`${ui.input} ml-6 w-auto`} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">{t('export.choose')}</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {s.date ? ` (${s.date})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </Modal>
  );
}
