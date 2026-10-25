import {
  wavelengthNightPoints,
  type RoomMember,
  type WavelengthPublic,
} from '@family-night/shared';
import { Button } from '../../components/Button';
import { Standings } from './Standings';

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
  const night = wavelengthNightPoints(match);
  const unscored = Object.keys(night).length === 0;

  return (
    <section aria-labelledby="final-title" className="flex flex-col gap-6">
      <Standings
        titleId="final-title"
        match={match}
        players={members}
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
