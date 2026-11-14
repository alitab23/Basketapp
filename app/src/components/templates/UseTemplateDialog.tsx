import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/schema';
import { addDrill, addSeasonWithSessions, addSession, listSeasons } from '../../db/repository';
import { drillFromContent, isDrillTemplate, isSeasonTemplate, isSessionTemplate, scheduleDates, seasonFromTemplate, sessionFromContent } from '../../templates/apply';
import { todayISO, weekdayNames } from '../../lib/dates';
import type { Template } from '../../types/model';
import { Modal } from '../Modal';
import { ui } from '../ui';

/** Default weekdays for N sessions per week (ISO: 1 = Monday). */
export function defaultWeekdays(perWeek: number): number[] {
  return ({ 1: [2], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] } as Record<number, number[]>)[perWeek] ?? [2, 4];
}

/**
 * "Använd template": always a new copy; season, date and start time are
 * chosen in the same step (SPEC.md section 6).
 */
export function UseTemplateDialog({ template, onClose, defaultSeasonId }: { template: Template; onClose: () => void; defaultSeasonId?: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const id = useId();
  const seasons = useLiveQuery(() => listSeasons(db), []) ?? [];
  const [seasonId, setSeasonId] = useState(defaultSeasonId ?? '');
  const [date, setDate] = useState(todayISO());
  const sessionContent = isSessionTemplate(template) ? template.content : null;
  const seasonTpl = isSeasonTemplate(template) ? template.content : null;
  const [startTime, setStartTime] = useState(sessionContent?.startTime ?? seasonTpl?.sessions[0]?.startTime ?? '18:00');
  const [name, setName] = useState(seasonTpl?.name ?? template.name);
  const [weekdays, setWeekdays] = useState<number[]>(defaultWeekdays(seasonTpl?.sessionsPerWeek ?? 2));
  const [busy, setBusy] = useState(false);
  const days = weekdayNames(i18n.language);

  const count = seasonTpl ? seasonTpl.weeks * weekdays.length : 0;
  const lastDate = seasonTpl && weekdays.length ? scheduleDates(date, weekdays, count).at(-1) : undefined;

  async function create() {
    setBusy(true);
    try {
      if (sessionContent) {
        const s = sessionFromContent(sessionContent, { seasonId: seasonId || null, date: date || undefined, startTime }, template.id);
        await addSession(db, s);
        void navigate(`/pass/${s.id}`);
      } else if (seasonTpl) {
        const { season, sessions } = seasonFromTemplate(seasonTpl, { name: name.trim() || template.name, startDate: date, weekdays, startTime }, template.id);
        await addSeasonWithSessions(db, season, sessions);
        void navigate(`/sasong/${season.id}`);
      } else if (isDrillTemplate(template)) {
        const d = drillFromContent(template.content);
        await addDrill(db, d);
        void navigate(`/ovning/${d.id}`);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || (seasonTpl !== null && weekdays.length === 0) || ((sessionContent || seasonTpl) && !date);

  return (
    <Modal
      title={t('templates.useTitle', { name: template.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.secondary} onClick={onClose}>
            {t('templates.cancel')}
          </button>
          <button type="button" className={ui.primary} onClick={() => void create()} disabled={!!disabled}>
            {t('templates.create')}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">{isDrillTemplate(template) ? t('templates.drillInfo') : t('templates.copyInfo')}</p>

      {seasonTpl && (
        <div>
          <label className={ui.label} htmlFor={`${id}-name`}>
            {t('templates.seasonName')}
          </label>
          <input id={`${id}-name`} className={ui.input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}

      {sessionContent && (
        <div>
          <label className={ui.label} htmlFor={`${id}-season`}>
            {t('templates.season')}
          </label>
          <select id={`${id}-season`} className={ui.input} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            <option value="">{t('templates.noSeason')}</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {(sessionContent || seasonTpl) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ui.label} htmlFor={`${id}-date`}>
              {seasonTpl ? t('templates.startDate') : t('templates.date')}
            </label>
            <input id={`${id}-date`} type="date" className={ui.input} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={ui.label} htmlFor={`${id}-time`}>
              {t('templates.startTime')}
            </label>
            <input id={`${id}-time`} type="time" className={ui.input} value={startTime} onChange={(e) => e.target.value && setStartTime(e.target.value)} />
          </div>
        </div>
      )}

      {seasonTpl && (
        <fieldset>
          <legend className={ui.label}>{t('templates.weekdays')}</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {days.map((d, i) => {
              const iso = i + 1;
              const on = weekdays.includes(iso);
              return (
                <label key={d} className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm capitalize ${on ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100' : 'border-slate-300 dark:border-slate-600'}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => setWeekdays((w) => (on ? w.filter((x) => x !== iso) : [...w, iso].sort()))}
                  />
                  {d}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" data-testid="season-preview">
            {weekdays.length === 0 ? t('templates.needWeekday') : `${t('templates.weekdaysHint', { weeks: seasonTpl.weeks, count })}${lastDate ? ` · ${date} – ${lastDate}` : ''}`}
          </p>
        </fieldset>
      )}
    </Modal>
  );
}
