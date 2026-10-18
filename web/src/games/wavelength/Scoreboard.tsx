import type { RoomMember, WavelengthPublic } from '@family-night/shared';
import { nameOf } from '../../components/match';
import { ranking } from './model';

export function Scoreboard({
  match,
  members,
  selfId,
  title,
}: {
  match: WavelengthPublic;
  members: RoomMember[];
  selfId: string;
  title: string;
}) {
  const rows = ranking(match);
  const best = rows[0]?.points ?? 0;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-bold">{title}</h3>
      <ol
        aria-label={title}
        className="flex flex-col divide-y divide-cream/10 rounded-2xl bg-night-soft ring-1 ring-cream/10"
      >
        {rows.map(({ playerId, points }, index) => (
          <li key={playerId} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-baseline gap-3">
              <span className="w-6 shrink-0 text-right text-cream/60 tabular-nums">
                {index + 1}
              </span>
              <span
                className={`min-w-0 break-words ${points === best && best > 0 ? 'font-bold' : ''}`}
              >
                {nameOf(members, playerId)}
                {playerId === selfId && <span className="ml-2 text-cream/60">(tú)</span>}
              </span>
            </span>
            <span className="shrink-0 font-bold text-moon tabular-nums">{points}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
