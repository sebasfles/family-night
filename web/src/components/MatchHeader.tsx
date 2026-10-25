import { AbortMatchMenu } from './AbortMatchMenu';
import { EyeIcon } from './icons';

interface MatchHeaderProps {
  round: number;
  finished: boolean;
  subtitle: string;
  badge: string | null;
  canAbort: boolean;
  aborting: boolean;
  onAbort: () => void;
  abortTitle?: string;
}

export function MatchHeader({
  round,
  finished,
  subtitle,
  badge,
  canAbort,
  aborting,
  onAbort,
  abortTitle,
}: MatchHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-3xl font-bold">
          {finished ? 'Fin de la partida' : `Ronda ${String(round)}`}
        </h1>
        <p className="text-base break-words text-cream/70">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && (
          <span className="flex items-center gap-1.5 rounded-full bg-lagoon/14 py-1 pr-3 pl-2.5 text-base font-bold text-lagoon">
            <EyeIcon className="size-4" />
            {badge}
          </span>
        )}
        {canAbort && <AbortMatchMenu aborting={aborting} onAbort={onAbort} title={abortTitle} />}
      </div>
    </header>
  );
}
