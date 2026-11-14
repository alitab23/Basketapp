import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastMessage {
  id: number;
  text: string;
  action?: ToastAction;
}

const ToastContext = createContext<(text: string, action?: ToastAction) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const TOAST_MS = 6000;

/** Short messages at the bottom ("Sparad i Biblioteket", "Flyttades till papperskorgen – Ångra"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const show = useCallback((text: string, action?: ToastAction) => {
    setToasts((list) => [...list.slice(-2), { id: Date.now() + Math.random(), text, action }]);
  }, []);
  const remove = (id: number) => setToasts((list) => list.filter((x) => x.id !== id));
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-center gap-2 sm:bottom-6">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDone={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
  const { t } = useTranslation();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => done.current(), TOAST_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div role="status" data-testid="toast" className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-slate-700">
      <span className="flex-1">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="font-semibold text-orange-300 hover:underline"
          onClick={() => {
            toast.action!.onClick();
            onDone();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={onDone} aria-label={t('toast.close')} className="text-white/70 hover:text-white">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
