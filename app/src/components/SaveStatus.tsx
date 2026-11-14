import { useTranslation } from 'react-i18next';
import { useOnline } from '../hooks/useOnline';
import type { SaveState } from '../hooks/useSessionEditor';

/** "Sparat" / "Sparar…" / "Offline – sparas lokalt" (SPEC.md section 4). */
export function SaveStatus({ state }: { state: SaveState }) {
  const { t } = useTranslation();
  const online = useOnline();
  const text = state === 'saving' ? t('save.saving') : online ? t('save.saved') : t('save.offline');
  return (
    <span role="status" data-testid="save-status" className="text-xs text-slate-500 dark:text-slate-400">
      {text}
    </span>
  );
}
