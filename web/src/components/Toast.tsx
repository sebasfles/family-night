import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ToastContext, type ShowToast } from './useToast';

const TOAST_MS = 2_500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const show = useCallback<ShowToast>((text) => {
    setToast({ id: Date.now(), text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {toast && (
          <p
            key={toast.id}
            role="status"
            className="max-w-sm rounded-2xl bg-cream px-5 py-3 text-center text-base font-semibold text-night shadow-lg"
          >
            {toast.text}
          </p>
        )}
      </div>
    </ToastContext>
  );
}
