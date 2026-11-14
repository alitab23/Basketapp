import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** An accessible dialog: focus moves in, Escape closes, focus returns on close. */
export function Modal({ title, onClose, children, footer, wide = false }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    (first ?? box.current)?.focus();
    return () => previous?.focus?.();
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-xl bg-white shadow-xl outline-none dark:bg-slate-800`}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h2 id={titleId} className="flex-1 text-lg font-semibold">
            {title}
          </h2>
          <button type="button" data-close onClick={onClose} aria-label={t('toast.close')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
