import type { RoomMember, WavelengthPublic } from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import { ranking } from './model';
import { Scoreboard } from './Scoreboard';

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
  const rows = ranking(match);
  const best = rows[0]?.points ?? 0;
  const winners = rows.filter((row) => row.points === best).map((row) => row.playerId);
  const names = winners.map((playerId) => nameOf(members, playerId));

  return (
    <section aria-labelledby="final-title" className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1 rounded-3xl bg-moon p-6 text-center text-night">
        <h2 id="final-title" className="text-3xl font-bold text-balance">
          {best === 0
            ? 'Nadie sumó puntos'
            : winners.length === 1
              ? `Ganó ${names.join('')}`
              : `Empate: ${names.join(', ')}`}
        </h2>
        {best > 0 && <p className="text-xl font-semibold">con {best} puntos</p>}
      </div>

      <Scoreboard match={match} members={members} selfId={selfId} title="Puntos de esta partida" />

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
