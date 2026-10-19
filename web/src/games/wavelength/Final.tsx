import {
  wavelengthNightPoints,
  type RoomMember,
  type WavelengthPublic,
} from '@family-night/shared';
import { Button } from '../../components/Button';
import { CrownIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
import { Scoreboard } from '../../components/Scoreboard';
import { ranked } from '../../components/scores';
import { scoreRows } from './model';

interface FinalProps {
  match: WavelengthPublic;
  members: RoomMember[];
  selfId: string;
  isHost: boolean;
  rematching: boolean;
  leaving: boolean;
  onRematch: () => void;
  onLobby: () => void;
}

export function Final({
  match,
  members,
  selfId,
  isHost,
  rematching,
  leaving,
  onRematch,
  onLobby,
}: FinalProps) {
  const rows = scoreRows(match, 'match');
  const night = wavelengthNightPoints(match);
  const unscored = Object.keys(night).length === 0;
  const standings = ranked(rows);
  const best = standings[0]?.to ?? 0;
  const names = standings
    .filter((row) => row.to === best)
    .map((row) => nameOf(members, row.playerId));

  return (
    <section aria-labelledby="final-title" className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-card bg-linear-to-b from-moon-bright to-moon px-6 py-7 text-center text-night shadow-glow">
        <span className="flex size-16 items-center justify-center rounded-full bg-night/10">
          <CrownIcon className="size-9" />
        </span>
        <h2 id="final-title" className="text-4xl font-bold text-balance">
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
        members={members}
        selfId={selfId}
        night={night}
      />
      {unscored && (
        <p className="text-center text-lg text-balance text-cream/80">
          Con 2 jugadores siempre empatan, así que la partida no suma a la noche.
        </p>
      )}

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
