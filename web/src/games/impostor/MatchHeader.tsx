import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreIcon } from '../../components/icons';
import { impostorCountLabel, type Seat } from './model';

interface MatchHeaderProps {
  round: number;
  finished: boolean;
  impostorCount: number;
  seat: Seat;
  canAbort: boolean;
  aborting: boolean;
  onAbort: () => void;
}

const seatLabels: Record<Seat, string | null> = {
  PLAYER: null,
  ELIMINATED: 'Eliminado',
  SPECTATOR: 'Espectador',
};

export function MatchHeader({
  round,
  finished,
  impostorCount,
  seat,
  canAbort,
  aborting,
  onAbort,
}: MatchHeaderProps) {
  const label = seatLabels[seat];
  const [confirm, setConfirm] = useState(false);

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-2xl font-bold">
          {finished ? 'Fin de la partida' : `Ronda ${String(round)}`}
        </h1>
        <p className="text-base text-cream/70">
          {finished
            ? `${String(round)} ${round === 1 ? 'ronda' : 'rondas'}, ${impostorCountLabel(impostorCount)}`
            : `${impostorCountLabel(impostorCount)} en juego`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {label && (
          <span className="rounded-full bg-cream/15 px-3 py-1 text-base font-semibold">
            {label}
          </span>
        )}
        {canAbort && (
          <HostMenu
            onAbort={() => {
              setConfirm(true);
            }}
          />
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title="¿Terminar la partida? Nadie suma puntos."
          confirmLabel="Sí, terminar"
          busy={aborting}
          onConfirm={onAbort}
          onCancel={() => {
            setConfirm(false);
          }}
        />
      )}
    </header>
  );
}

function HostMenu({ onAbort }: { onAbort: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Opciones de la partida"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="flex size-12 items-center justify-center rounded-full text-cream/80 hover:bg-cream/10 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
      >
        <MoreIcon className="size-6" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 flex w-52 flex-col overflow-hidden rounded-2xl bg-cream text-night shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAbort();
            }}
            className="min-h-12 px-4 text-left font-semibold text-red-700 hover:bg-night/10"
          >
            Terminar partida
          </button>
        </div>
      )}
    </div>
  );
}
