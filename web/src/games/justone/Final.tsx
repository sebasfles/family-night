import type { JustOnePublic } from '@family-night/shared';
import { Button } from '../../components/Button';
import { CluesIcon } from '../../components/icons';
import { CountUp } from '../../motion/CountUp';
import { roundsLabel } from './model';

interface FinalProps {
  match: JustOnePublic;
  isHost: boolean;
  rematching: boolean;
  leaving: boolean;
  onRematch: () => void;
  onLobby: () => void;
}

export function Final({ match, isHost, rematching, leaving, onRematch, onLobby }: FinalProps) {
  const points = match.score === 1 ? '1 punto' : `${String(match.score)} puntos`;
  return (
    <section aria-labelledby="final-title" className="flex flex-col gap-6">
      <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-card bg-linear-to-b from-orchid to-orchid-deep px-6 py-8 text-center text-night shadow-lift">
        <CluesIcon className="pointer-events-none absolute -right-5 -bottom-5 size-32 rotate-12 text-night/10" />
        <p className="font-sans text-sm font-bold tracking-[0.18em] text-night/65 uppercase">
          Puntaje del equipo
        </p>
        <h2 id="final-title" className="font-display text-7xl leading-none font-bold tabular-nums">
          <CountUp from={0} to={match.score} />
        </h2>
        <p className="text-xl font-bold text-balance">
          {match.roundsWon === 0
            ? 'No acertaron ninguna ronda'
            : `Acertaron ${roundsLabel(match.roundsWon)}`}
        </p>
      </div>
      <p className="text-center text-lg text-balance text-cream/80">
        Cada jugador suma {points} al marcador de la noche.
      </p>

      {isHost ? (
        <div className="flex flex-col gap-3">
          <Button busy={rematching} disabled={leaving} onClick={onRematch}>
            Jugar otra vez
          </Button>
          <Button variant="ghost" busy={leaving} disabled={rematching} onClick={onLobby}>
            Volver al lobby
          </Button>
        </div>
      ) : (
        <p role="status" className="text-center text-lg text-cream/80">
          Esperando al host…
        </p>
      )}
    </section>
  );
}
