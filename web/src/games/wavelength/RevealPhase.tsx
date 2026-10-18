import { nextTurn, type RoomMember, type WavelengthPublic } from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import { Dial } from './Dial';
import { firstWord, pointsLabel } from './model';
import { Scoreboard } from './Scoreboard';

interface RevealPhaseProps {
  match: WavelengthPublic;
  members: RoomMember[];
  selfId: string;
  isHost: boolean;
  busy: boolean;
  onNext: () => void;
}

export function RevealPhase({ match, members, selfId, isHost, busy, onNext }: RevealPhaseProps) {
  const result = match.lastResult;
  if (!result) return null;
  const { left, right } = match.spectrum;
  const markers = result.guesses.flatMap((guess) =>
    guess.value === null
      ? []
      : [
          {
            id: guess.playerId,
            value: guess.value,
            label: firstWord(nameOf(members, guess.playerId)),
            highlight: guess.playerId === selfId,
          },
        ],
  );
  const last = nextTurn(match) === null;

  return (
    <section aria-labelledby="reveal-title" className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 id="reveal-title" className="text-2xl font-bold">
          El objetivo era {result.target}
        </h2>
        <p className="text-lg break-words text-cream/80">
          Pista de {nameOf(members, result.psychicId)}: «{match.clue}»
        </p>
      </div>

      <Dial
        label={`Objetivo en ${String(result.target)}, entre ${left} y ${right}`}
        left={left}
        right={right}
        target={result.target}
        markers={markers}
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">Puntos de la ronda</h3>
        <ul
          aria-label="Puntos de la ronda"
          className="flex flex-col divide-y divide-cream/10 rounded-2xl bg-night-soft ring-1 ring-cream/10"
        >
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 break-words">
              {nameOf(members, result.psychicId)} <span className="text-cream/60">(psíquico)</span>
            </span>
            <span className="shrink-0 font-bold text-moon tabular-nums">
              +{result.psychicPoints}
            </span>
          </li>
          {result.guesses.map((guess) => (
            <li key={guess.playerId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 break-words">
                {nameOf(members, guess.playerId)}{' '}
                <span className="text-cream/60">
                  {guess.value === null ? 'no respondió' : `marcó ${String(guess.value)}`}
                </span>
              </span>
              <span
                aria-label={pointsLabel(guess.points)}
                className={`shrink-0 font-bold tabular-nums ${guess.points > 0 ? 'text-moon' : 'text-cream/50'}`}
              >
                +{guess.points}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Scoreboard match={match} members={members} selfId={selfId} title="Puntaje" />

      {isHost ? (
        <Button busy={busy} onClick={onNext}>
          {last ? 'Ver resultado' : 'Siguiente ronda'}
        </Button>
      ) : (
        <p role="status" className="text-center text-lg text-cream/80">
          Esperando al host…
        </p>
      )}
    </section>
  );
}
