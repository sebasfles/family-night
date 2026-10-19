import { DIAL_BANDS, nextTurn, type RoomMember, type WavelengthPublic } from '@family-night/shared';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import { Scoreboard } from '../../components/Scoreboard';
import { Dial } from './Dial';
import { firstWord, pointsLabel, scoreRows } from './model';

interface RevealPhaseProps {
  match: WavelengthPublic;
  members: RoomMember[];
  selfId: string;
  isHost: boolean;
  busy: boolean;
  onNext: () => void;
}

const POINT_TONES = ['bg-moon-bright text-night', 'bg-ember text-night', 'bg-orchid text-night'];

function pointsTone(points: number): string {
  const band = DIAL_BANDS.findIndex((entry) => entry.points === points);
  return POINT_TONES[band] ?? 'bg-cream/8 text-cream/55';
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
  const rows = [
    {
      playerId: result.psychicId,
      note: '(psíquico)',
      points: result.psychicPoints,
      tone: 'bg-moon/16 text-moon',
    },
    ...result.guesses.map((guess) => ({
      playerId: guess.playerId,
      note: guess.value === null ? 'no respondió' : `marcó ${String(guess.value)}`,
      points: guess.points,
      tone: pointsTone(guess.points),
    })),
  ];

  return (
    <section aria-labelledby="reveal-title" className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 id="reveal-title" className="text-3xl font-bold">
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
        reveal
      />

      <section className="flex flex-col gap-3">
        <h3 className="text-xl font-bold">Puntos de la ronda</h3>
        <ul aria-label="Puntos de la ronda" className="flex flex-col gap-1.5 surface p-2">
          {rows.map(({ playerId, note, points, tone }) => {
            const name = nameOf(members, playerId);
            return (
              <li key={playerId} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <Avatar playerId={playerId} name={name} className="size-10 text-sm" />
                <span className="min-w-0 flex-1 break-words">
                  <span className="font-semibold">{name}</span>{' '}
                  <span className="text-cream/60">{note}</span>
                </span>
                <span
                  aria-label={pointsLabel(points)}
                  className={`flex h-9 min-w-11 shrink-0 items-center justify-center rounded-full px-2.5 font-display text-lg font-bold tabular-nums ${tone}`}
                >
                  +{points}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Scoreboard
        title="Puntaje"
        rows={scoreRows(match, 'round')}
        members={members}
        selfId={selfId}
        gains
      />

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
