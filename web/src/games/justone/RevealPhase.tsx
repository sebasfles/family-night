import {
  nextJustOneTurn,
  type JustOnePublic,
  type JustOneResult,
  type RoomMember,
} from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';

interface RevealPhaseProps {
  match: JustOnePublic;
  members: RoomMember[];
  selfId: string;
  isHost: boolean;
  accepting: boolean;
  advancing: boolean;
  onAccept: () => void;
  onNext: () => void;
}

const roundPoints = { CORRECT: '+1', PASS: '0', WRONG: '−1' } as const;

function verdict(result: JustOneResult, guesser: string | null): string {
  const said = `${guesser ? `${guesser} dijo` : 'Dijiste'} «${result.guess ?? ''}»`;
  if (result.outcome === 'PASS') return guesser ? `${guesser} pasó` : 'Pasaste';
  if (result.accepted) return `${said}, cuenta como acierto`;
  if (result.outcome === 'WRONG') return `${said}. No era`;
  return guesser ? `¡${guesser} acertó!` : '¡Acertaste!';
}

export function RevealPhase({
  match,
  members,
  selfId,
  isHost,
  accepting,
  advancing,
  onAccept,
  onNext,
}: RevealPhaseProps) {
  const result = match.lastResult;
  if (!result) return null;
  const guesser = result.guesserId === selfId ? null : nameOf(members, result.guesserId);
  const floored = result.outcome === 'WRONG' && result.scoreBefore === 0;
  const won = result.outcome === 'CORRECT';
  const last = nextJustOneTurn(match) === null;

  return (
    <section aria-labelledby="reveal-title" className="flex flex-col gap-5">
      <div
        className={`flex flex-col items-center gap-2 rounded-3xl p-6 text-center ${
          won ? 'bg-moon text-night' : 'bg-night-soft ring-1 ring-cream/10'
        }`}
      >
        <p className={`text-base font-semibold ${won ? 'text-night/70' : 'text-cream/70'}`}>
          La palabra era
        </p>
        <h2 id="reveal-title" className="text-4xl font-bold break-words">
          {result.word}
        </h2>
        <p className="text-xl font-semibold text-balance break-words">{verdict(result, guesser)}</p>
      </div>

      <div role="status" className="flex flex-col items-center gap-1 text-center">
        <p className="text-2xl font-bold">
          Puntaje del equipo: <span className="text-moon tabular-nums">{result.score}</span>
        </p>
        <p className="text-lg text-cream/80">
          Esta ronda: <span className="font-bold tabular-nums">{roundPoints[result.outcome]}</span>
          {floored && ', el puntaje no baja de 0'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">Pistas</h3>
        <ul
          aria-label="Pistas de la ronda"
          className="flex flex-col divide-y divide-cream/10 rounded-2xl bg-night-soft ring-1 ring-cream/10"
        >
          {result.clues.map((clue) => (
            <li key={clue.authorId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-col">
                <span
                  className={`text-xl font-bold break-words ${clue.cancelled ? 'text-cream/50 line-through' : ''}`}
                >
                  {clue.clue}
                </span>
                <span className="text-base text-cream/60">{nameOf(members, clue.authorId)}</span>
              </span>
              {clue.cancelled && (
                <span className="shrink-0 rounded-full bg-cream/10 px-3 py-1 text-sm font-semibold text-cream/70">
                  Tachada
                </span>
              )}
            </li>
          ))}
          {result.clues.length === 0 && (
            <li className="px-4 py-3 text-cream/70">Nadie escribió una pista</li>
          )}
        </ul>
      </div>

      {isHost ? (
        <div className="flex flex-col gap-3">
          {result.outcome === 'WRONG' && (
            <Button variant="secondary" busy={accepting} disabled={advancing} onClick={onAccept}>
              Contar como acierto
            </Button>
          )}
          <Button busy={advancing} disabled={accepting} onClick={onNext}>
            {last ? 'Ver resultado' : 'Siguiente ronda'}
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
