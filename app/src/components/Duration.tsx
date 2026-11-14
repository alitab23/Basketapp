import { useTranslation } from 'react-i18next';
import { splitMinutes } from '../lib/time';

/** Shows minutes as "1 h 20 min", "2 h" or "45 min". */
export function Duration({ minutes }: { minutes: number }) {
  const { t } = useTranslation();
  const { hours, minutes: m } = splitMinutes(minutes);
  if (hours === 0) return <>{t('duration.minutes', { minutes: m })}</>;
  if (m === 0) return <>{t('duration.hours', { hours })}</>;
  return <>{t('duration.hoursMinutes', { hours, minutes: m })}</>;
}
