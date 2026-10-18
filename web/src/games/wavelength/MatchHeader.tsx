import { AbortMatchMenu } from '../../components/AbortMatchMenu';
import type { Seat } from './model';

interface MatchHeaderProps {
  round: number;
  finished: boolean;
  subtitle: string;
  seat: Seat;
  canAbort: boolean;
  aborting: boolean;
  onAbort: () => void;
}

const seatLabels: Record<Seat, string | null> = {
  PSYCHIC: null,
  GUESSER: null,
  SPECTATOR: 'Espectador',
};

export function MatchHeader({
  round,
  finished,
  subtitle,
  seat,
  canAbort,
  aborting,
  onAbort,
}: MatchHeaderProps) {
  const label = finished ? null : seatLabels[seat];
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-2xl font-bold">
          {finished ? 'Fin de la partida' : `Ronda ${String(round)}`}
        </h1>
        <p className="text-base break-words text-cream/70">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {label && (
          <span className="rounded-full bg-cream/15 px-3 py-1 text-base font-semibold">
            {label}
          </span>
        )}
        {canAbort && <AbortMatchMenu aborting={aborting} onAbort={onAbort} />}
      </div>
    </header>
  );
}
