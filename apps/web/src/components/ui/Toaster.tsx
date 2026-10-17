import { X } from 'lucide-react';
import { Toast } from 'radix-ui';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const TONES: Record<ToastTone, string> = {
  success: 'border-teal-600/30',
  error: 'border-red-600/40',
  info: 'border-slate-300 dark:border-slate-700',
};

let nextId = 1;

/** Radix toasts, announced politely to screen readers (frontend-spec §8). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    setToasts((prev) => [...prev, { id: nextId++, message, tone }]);
  }, []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right" duration={4000}>
        {children}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            type={t.tone === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className={`flex items-start gap-3 rounded-xl border bg-white p-3 text-sm shadow-lg dark:bg-slate-900 ${TONES[t.tone]}`}
          >
            <Toast.Description className="flex-1">{t.message}</Toast.Description>
            <Toast.Close aria-label="Dismiss" className="text-slate-500">
              <X className="size-4" aria-hidden />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
