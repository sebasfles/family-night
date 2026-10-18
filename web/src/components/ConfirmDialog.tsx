import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-night-soft p-6 ring-1 ring-cream/10"
      >
        <h2 id={titleId} className="text-center text-xl font-bold">
          {title}
        </h2>
        <div className="flex flex-col gap-3">
          <Button variant="danger" busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
