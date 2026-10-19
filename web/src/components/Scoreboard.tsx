import type { RoomMember } from '@family-night/shared';
import { CountUp } from '../motion/CountUp';
import { useShuffleIn } from '../motion/shuffle';
import { SHIFT_DELAY_MS, SHIFT_MS } from '../motion/timing';
import { useReducedMotion } from '../motion/useReducedMotion';
import { Avatar } from './Avatar';
import { nameOf } from './match';
import { byScore, ranked, type ScoreRow } from './scores';

const medals = ['bg-moon text-night', 'bg-sand text-night', 'bg-ember text-night'];

interface ScoreboardProps {
  title: string;
  rows: ScoreRow[];
  members: RoomMember[];
  selfId: string;
  signed?: boolean;
  gains?: boolean;
  night?: Readonly<Record<string, number>>;
  ranks?: Readonly<Record<string, number>>;
}

export function Scoreboard({
  title,
  rows,
  members,
  selfId,
  signed = false,
  gains = false,
  night,
  ranks,
}: ScoreboardProps) {
  const reduced = useReducedMotion();
  const list = useShuffleIn<HTMLOListElement>(
    rows.toSorted(byScore('from')).map((row) => row.playerId),
  );
  const standings = ranks
    ? rows
        .map((row) => ({ ...row, rank: ranks[row.playerId] ?? rows.length }))
        .toSorted((a, b) => a.rank - b.rank || b.to - a.to)
    : ranked(rows);
  const best = standings[0]?.to ?? 0;
  const soleLeader = best > 0 && standings.filter((row) => row.rank === 1).length === 1;
  const format = (value: number) => (signed ? `+${String(value)}` : String(value));

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xl font-bold">{title}</h3>
      <ol ref={list} aria-label={title} className="flex flex-col gap-1.5 surface p-2">
        {standings.map(({ playerId, from, to, rank }) => {
          const leader = soleLeader && rank === 1;
          const gain = to - from;
          const earned = night?.[playerId] ?? 0;
          return (
            <li
              key={playerId}
              data-row={playerId}
              className={`flex items-center gap-2.5 rounded-2xl py-2.5 pr-3 pl-2 ${
                leader ? 'bg-moon/12 ring-1 ring-moon/45' : ''
              }`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold tabular-nums ${
                  medals[rank - 1] ?? 'bg-night-raised text-cream/75'
                } ${reduced ? '' : 'animate-fade-in'}`}
                style={
                  reduced ? undefined : { animationDelay: `${String(SHIFT_DELAY_MS + SHIFT_MS)}ms` }
                }
              >
                {rank}
              </span>
              <Avatar
                playerId={playerId}
                name={nameOf(members, playerId)}
                className="size-10 text-sm"
              />
              <span
                className={`min-w-0 flex-1 break-words ${leader ? 'font-bold' : 'font-semibold'}`}
              >
                {nameOf(members, playerId)}
                {playerId === selfId && (
                  <span className="ml-1.5 font-normal text-cream/60">(tú)</span>
                )}
                {earned > 0 && (
                  <span className="block text-sm font-bold text-sage tabular-nums">
                    +{earned} a la noche
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span
                  className={`font-display text-2xl leading-none font-bold tabular-nums ${
                    to > 0 ? 'text-moon' : 'text-cream/45'
                  }`}
                >
                  <CountUp from={from} to={to} format={format} />
                </span>
                {gains && gain > 0 && (
                  <span
                    aria-hidden="true"
                    className="mt-1 text-sm font-bold text-sage tabular-nums"
                  >
                    +{gain}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
