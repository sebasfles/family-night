import {
  manadaNightPoints,
  manadaPlayers,
  type ManadaPublic,
  type RoomMember,
} from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import { Scoreboard } from '../../components/Scoreboard';
import { CowCard } from './CowCard';
import { WinnerBanner } from './WinnerBanner';

interface FinalProps {
  match: ManadaPublic;
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
  const players = manadaPlayers(match);
  const night = manadaNightPoints(match);
  const ranks = Object.fromEntries(
    players.map((id) => [id, players.length - (night[id] ?? 0) + 1]),
  );
  const best = match.winnerIds.length > 0 ? (match.totals[match.winnerIds[0] ?? ''] ?? 0) : 0;

  return (
    <section aria-labelledby="final-title" className="flex flex-col gap-6">
      <WinnerBanner
        titleId="final-title"
        winners={match.winnerIds.map((id) => nameOf(members, id))}
        points={best}
      />

      {match.cowHolderId !== null && (
        <CowCard
          holderId={match.cowHolderId}
          previousId={match.cowHolderId}
          members={members}
          selfId={selfId}
        />
      )}

      <Scoreboard
        title="Puntos de esta partida"
        rows={players.map((playerId) => ({
          playerId,
          from: match.totals[playerId] ?? 0,
          to: match.totals[playerId] ?? 0,
        }))}
        members={members}
        selfId={selfId}
        night={night}
        ranks={ranks}
      />

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
