import { AbortMatchMenu } from '../../components/AbortMatchMenu';

interface MatchHeaderProps {
  round: number;
  finished: boolean;
  subtitle: string;
  spectator: boolean;
  canAbort: boolean;
  aborting: boolean;
  onAbort: () => void;
}

export function MatchHeader({
  round,
  finished,
  subtitle,
  spectator,
  canAbort,
  aborting,
  onAbort,
}: MatchHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-2xl font-bold">
          {finished ? 'Fin de la partida' : `Ronda ${String(round)}`}
        </h1>
        <p className="text-base break-words text-cream/70">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {spectator && !finished && (
          <span className="rounded-full bg-cream/15 px-3 py-1 text-base font-semibold">
            Espectador
          </span>
        )}
        {canAbort && <AbortMatchMenu aborting={aborting} onAbort={onAbort} />}
      </div>
    </header>
  );
}
