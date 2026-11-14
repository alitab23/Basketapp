import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Season, Session } from '../../types/model';
import { ui } from '../ui';

type Patch = Partial<Omit<Session, 'id' | 'items'>>;

interface Props {
  session: Session;
  seasons: Season[];
  onChange: (patch: Patch, coalesceKey: string) => void;
}

/** Session header – every field is edited in place (SPEC.md section 4). */
export function SessionHeader({ session, seasons, onChange }: Props) {
  const { t } = useTranslation();
  const id = useId();

  const text = (field: 'location' | 'coach' | 'focus' | 'description') => ({
    id: `${id}-${field}`,
    value: session[field] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [field]: e.target.value || undefined }, field),
  });

  const number = (field: 'participants' | 'maxDuration') => ({
    id: `${id}-${field}`,
    type: 'number',
    min: 0,
    inputMode: 'numeric' as const,
    value: session[field] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = e.target.valueAsNumber;
      onChange({ [field]: Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined }, field);
    },
  });

  return (
    <div className="space-y-4">
      <label className="sr-only" htmlFor={`${id}-title`}>
        {t('session.title')}
      </label>
      <input
        id={`${id}-title`}
        className={`${ui.inline} text-2xl font-semibold`}
        value={session.title}
        onChange={(e) => onChange({ title: e.target.value }, 'title')}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div>
          <label className={ui.label} htmlFor={`${id}-date`}>
            {t('session.date')}
          </label>
          <input
            id={`${id}-date`}
            type="date"
            className={ui.input}
            value={session.date ?? ''}
            onChange={(e) => onChange({ date: e.target.value || undefined }, 'date')}
          />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-start`}>
            {t('session.startTime')}
          </label>
          <input
            id={`${id}-start`}
            type="time"
            className={ui.input}
            value={session.startTime}
            onChange={(e) => e.target.value && onChange({ startTime: e.target.value }, 'startTime')}
          />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-location`}>
            {t('session.location')}
          </label>
          <input className={ui.input} {...text('location')} />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-participants`}>
            {t('session.participants')}
          </label>
          <input className={ui.input} {...number('participants')} />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-coach`}>
            {t('session.coach')}
          </label>
          <input className={ui.input} {...text('coach')} />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-focus`}>
            {t('session.focus')}
          </label>
          <input className={ui.input} {...text('focus')} />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-maxDuration`}>
            {t('session.maxDuration')}
          </label>
          <input className={ui.input} {...number('maxDuration')} />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-season`}>
            {t('session.season')}
          </label>
          <select
            id={`${id}-season`}
            className={ui.input}
            value={session.seasonId ?? ''}
            onChange={(e) => onChange({ seasonId: e.target.value || null }, 'season')}
          >
            <option value="">{t('session.noSeason')}</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={ui.label} htmlFor={`${id}-description`}>
          {t('session.description')}
        </label>
        <textarea rows={2} className={ui.input} {...text('description')} />
      </div>
    </div>
  );
}
