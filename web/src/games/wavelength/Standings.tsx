import type { Player, WavelengthPublic } from '@family-night/shared';
import { CrownIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
import { Scoreboard } from '../../components/Scoreboard';
import { ranked } from '../../components/scores';
import { scoreRows } from './model';

interface StandingsProps {
  titleId: string;
  match: WavelengthPublic;
  players: readonly Player[];
  selfId: string;
  night?: Readonly<Record<string, number>>;
}

export function Standings({ titleId, match, players, selfId, night }: StandingsProps) {
  const rows = scoreRows(match, 'match');
  const standings = ranked(rows);
  const best = standings[0]?.to ?? 0;
  const names = standings
    .filter((row) => row.to === best)
    .map((row) => nameOf(players, row.playerId));

  return (
    <>
      <div className="flex flex-col items-center gap-3 rounded-card bg-linear-to-b from-moon-bright to-moon px-6 py-7 text-center text-night shadow-glow">
        <span className="flex size-16 items-center justify-center rounded-full bg-night/10">
          <CrownIcon className="size-9" />
        </span>
        <h2 id={titleId} className="text-4xl font-bold text-balance">
          {best === 0
            ? 'Nadie sumó puntos'
            : names.length === 1
              ? `Ganó ${names.join('')}`
              : `Empate: ${names.join(', ')}`}
        </h2>
        {best > 0 && <p className="text-xl font-bold">con {best} puntos</p>}
      </div>

      <Scoreboard
        title="Puntos de esta partida"
        rows={rows}
        members={players}
        selfId={selfId}
        night={night}
      />
    </>
  );
}
