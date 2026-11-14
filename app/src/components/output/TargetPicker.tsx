import { useId, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/schema';
import { listAllSessions, listSeasons } from '../../db/repository';
import { ui } from '../ui';
import type { OutputTarget } from './target';

/** Choose a session or a season, when the menu is opened outside one. */
export function TargetPicker({ value, onChange }: { value: OutputTarget | null; onChange: (t: OutputTarget | null) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const seasons = useLiveQuery(() => listSeasons(db), []) ?? [];
  const sessions = useLiveQuery(() => listAllSessions(db), []) ?? [];
  const [kind, setKind] = useState<OutputTarget['kind']>(value?.kind ?? 'session');
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">{t('pdf.target')}</legend>
      {(['session', 'season'] as const).map((k) => (
        <div key={k} className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name={`${id}-kind`} className="accent-orange-500" checked={kind === k} onChange={() => {
                setKind(k);
                onChange(value?.kind === k ? value : null);
              }}
            />
            {t(`pdf.${k}`)}
          </label>
          {kind === k && (
            <select
              aria-label={t(`pdf.${k}`)}
              className={`${ui.input} w-auto`}
              value={value?.kind === k ? value.id : ''}
              onChange={(e) => onChange(e.target.value ? { kind: k, id: e.target.value } : null)}
            >
              <option value="">{t('pdf.choose')}</option>
              {(k === 'session' ? sessions.map((s) => ({ id: s.id, label: `${s.title}${s.date ? ` (${s.date})` : ''}` })) : seasons.map((s) => ({ id: s.id, label: s.name }))).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </fieldset>
  );
}
