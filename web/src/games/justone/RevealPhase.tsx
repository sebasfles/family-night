import {
  nextJustOneTurn,
  type JustOnePublic,
  type JustOneResult,
  type RoomMember,
} from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import { CountUp } from '../../motion/CountUp';
import { FlipReveal } from '../../motion/Flip';
import { ClueCard } from './ClueCard';
import { WordBack } from './WordCard';

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
const verdictTones = {
  CORRECT: 'bg-sage text-night',
  WRONG: 'bg-ember text-night',
  PASS: 'bg-sand text-night',
} as const;

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
    <section aria-labelledby="reveal-title" className="flex flex-col gap-6">
      <FlipReveal back={<WordBack />}>
        <div
          className={`flex min-h-56 flex-col items-center justify-center gap-3 rounded-card px-6 py-7 text-center card-paper ${
            won ? 'ring-4 ring-sage/70' : ''
          }`}
        >
          <p className="font-sans text-sm font-bold tracking-[0.18em] text-night/65 uppercase">
            La palabra era
          </p>
          <h2
            id="reveal-title"
            className="font-display text-5xl leading-tight font-bold break-words"
          >
            {result.word}
          </h2>
          <p
            className={`rounded-2xl px-4 py-2 text-lg font-bold text-balance break-words ${verdictTones[result.outcome]}`}
          >
            {verdict(result, guesser)}
          </p>
        </div>
      </FlipReveal>

      <div role="status" className="flex flex-col items-center gap-2 text-center">
        <p className="flex items-center gap-3 text-xl font-bold">
          Puntaje del equipo:{' '}
          <span className="flex size-16 items-center justify-center rounded-full bg-moon/14 font-display text-4xl text-moon tabular-nums ring-1 ring-moon/40">
            <CountUp from={result.scoreBefore} to={result.score} />
          </span>
        </p>
        <p className="text-lg text-cream/80">
          Esta ronda: <span className="font-bold tabular-nums">{roundPoints[result.outcome]}</span>
          {floored && ', el puntaje no baja de 0'}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-xl font-bold">Pistas</h3>
        {result.clues.length === 0 ? (
          <p className="text-cream/70">Nadie escribió una pista</p>
        ) : (
          <ul aria-label="Pistas de la ronda" className="grid grid-cols-2 gap-3 px-1 pt-2">
            {result.clues.map((clue, index) => (
              <li key={clue.authorId} className="flex">
                <ClueCard
                  clue={clue.clue}
                  index={index}
                  author={nameOf(members, clue.authorId)}
                  cancelled={clue.cancelled}
                  stamp={clue.cancelled ? 'Tachada' : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

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
