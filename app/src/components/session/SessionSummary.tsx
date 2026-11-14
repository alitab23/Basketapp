import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { minutesByBlockType, type Schedule } from '../../lib/schedule';
import type { Block, BlockType } from '../../types/model';
import { Duration } from '../Duration';

interface Props {
  schedule: Schedule;
  items: Block[];
  blockTypes: Map<string, BlockType>;
  maxDuration?: number;
}

const NO_TYPE_COLOR = '#CBD5E1';

/** Total time, start–end and a coloured bar split by block type. */
export function SessionSummary({ schedule, items, blockTypes, maxDuration }: Props) {
  const { t } = useTranslation();
  const parts = minutesByBlockType(items);
  const over = maxDuration ? schedule.total - maxDuration : 0;

  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="text-slate-500 dark:text-slate-400">{t('session.total')}</span>
        <span data-testid="session-total" className="text-lg font-semibold">
          <Duration minutes={schedule.total} />
        </span>
        <span data-testid="session-range" className="tabular-nums text-slate-600 dark:text-slate-300">
          {schedule.startLabel}–{schedule.endLabel}
          {schedule.endDayOffset > 0 && <span className="ml-1 text-xs">({t('session.nextDay')})</span>}
        </span>
      </p>

      {schedule.total > 0 && (
        <div>
          <div
            role="img"
            aria-label={t('session.distribution')}
            className="flex h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
          >
            {parts.map((p) => {
              const type = p.blockTypeId ? blockTypes.get(p.blockTypeId) : undefined;
              return (
                <div
                  key={p.blockTypeId ?? 'none'}
                  style={{ width: `${(p.minutes / schedule.total) * 100}%`, background: type?.color ?? NO_TYPE_COLOR }}
                  title={`${type?.name ?? t('session.noType')}: ${p.minutes} min`}
                />
              );
            })}
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {parts.map((p) => {
              const type = p.blockTypeId ? blockTypes.get(p.blockTypeId) : undefined;
              return (
                <li key={p.blockTypeId ?? 'none'} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: type?.color ?? NO_TYPE_COLOR }} />
                  {type?.name ?? t('session.noType')} <Duration minutes={p.minutes} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {maxDuration !== undefined && over > 0 && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
        >
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('session.overMax', { over, max: maxDuration })}
        </p>
      )}
    </div>
  );
}
