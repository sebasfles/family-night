import {
  outcome,
  type Elimination,
  type ImpostorPublic,
  type RoundResult,
  type RoomMember,
} from '@family-night/shared';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { MaskIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
import { CountUp } from '../../motion/CountUp';
import { FlipReveal } from '../../motion/Flip';
import { Meter } from '../../motion/motion';
import { useShuffleIn } from '../../motion/shuffle';
import { CardBack } from './Card';

interface RevealProps {
  match: ImpostorPublic;
  members: RoomMember[];
  isHost: boolean;
  busy: boolean;
  onNext: () => void;
}

const nextLabels = {
  CONTINUE: 'Siguiente ronda',
  CIVILIANS: 'Ver resultado',
  IMPOSTORS: 'Ver resultado',
} as const;

export function Reveal({ match, members, isHost, busy, onNext }: RevealProps) {
  const result = match.lastResult;
  if (!result) return null;
  const out = match.eliminated.find(
    (elimination) =>
      elimination.round === result.round && elimination.playerId === result.eliminatedId,
  );
  const headline = result.tie
    ? out
      ? 'Empate: eliminado por sorteo'
      : 'Empate: nadie es eliminado'
    : out
      ? `${nameOf(members, out.playerId)} fue eliminado`
      : 'Nadie votó: nadie es eliminado';

  return (
    <section aria-labelledby="reveal-title" className="flex flex-col gap-5">
      <h2 id="reveal-title" className="text-center text-3xl font-bold text-balance">
        {headline}
      </h2>

      {out && (
        <FlipReveal
          back={
            <CardBack>
              <span className="mt-2 font-display text-5xl font-bold text-cream/80">?</span>
            </CardBack>
          }
        >
          <Verdict out={out} tie={result.tie} members={members} />
        </FlipReveal>
      )}

      <Tally match={match} result={result} members={members} />

      {isHost ? (
        <Button busy={busy} onClick={onNext}>
          {nextLabels[outcome(match)]}
        </Button>
      ) : (
        <p role="status" className="text-center text-lg text-cream/80">
          Esperando al host…
        </p>
      )}
    </section>
  );
}

function Verdict({ out, tie, members }: { out: Elimination; tie: boolean; members: RoomMember[] }) {
  const name = nameOf(members, out.playerId);
  const impostor = out.wasImpostor;
  return (
    <div
      role="status"
      className={`flex min-h-60 flex-col items-center justify-center gap-3 p-7 text-center ${
        impostor ? 'rounded-card card-wine' : 'rounded-card card-paper'
      }`}
    >
      <span className="relative">
        <Avatar
          playerId={out.playerId}
          name={name}
          className={`size-20 text-2xl ring-4 ${impostor ? 'ring-ember/60' : 'ring-night/10'}`}
        />
        {impostor && (
          <span className="absolute -right-2 -bottom-1 flex size-9 items-center justify-center rounded-full bg-ember text-night shadow-lift">
            <MaskIcon className="size-6" />
          </span>
        )}
      </span>
      <p className={`font-display text-3xl font-bold text-balance ${impostor ? 'text-ember' : ''}`}>
        {tie
          ? `${name} ${impostor ? 'era' : 'no era'} impostor`
          : impostor
            ? 'Era impostor'
            : 'No era impostor'}
      </p>
    </div>
  );
}

function Tally({
  match,
  result,
  members,
}: {
  match: ImpostorPublic;
  result: RoundResult;
  members: RoomMember[];
}) {
  const list = useShuffleIn<HTMLOListElement>(
    match.participants.filter((playerId) =>
      result.tally.some((entry) => entry.playerId === playerId),
    ),
  );
  const top = result.tally[0]?.votes ?? 0;

  return (
    <ol ref={list} aria-label="Votos" className="flex flex-col gap-1.5 surface p-2">
      {result.tally.map((entry) => {
        const eliminated = entry.playerId === result.eliminatedId;
        const name = nameOf(members, entry.playerId);
        return (
          <li
            key={entry.playerId}
            data-row={entry.playerId}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
              eliminated ? 'bg-moon/12 ring-1 ring-moon/45' : ''
            }`}
          >
            <Avatar playerId={entry.playerId} name={name} className="size-10 text-sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-lg">
                <span
                  className={`min-w-0 break-words ${eliminated ? 'font-bold' : 'font-semibold'}`}
                >
                  {name}
                </span>
                <span className="shrink-0 font-semibold text-cream/80 tabular-nums">
                  <CountUp from={0} to={entry.votes} /> {entry.votes === 1 ? 'voto' : 'votos'}
                </span>
              </div>
              <span aria-hidden="true" className="flex h-2 rounded-full bg-cream/10">
                <Meter
                  fraction={top ? entry.votes / top : 0}
                  className={`block h-2 rounded-full ${eliminated ? 'bg-moon' : 'bg-cream/35'}`}
                />
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
