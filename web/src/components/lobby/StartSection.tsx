import type { RoomMember } from '@family-night/shared';
import { Button } from '../Button';

interface StartSectionProps {
  players: RoomMember[];
  minPlayers: number;
  isHost: boolean;
  starting: boolean;
  onStart: () => void;
}

export function StartSection({
  players,
  minPlayers,
  isHost,
  starting,
  onStart,
}: StartSectionProps) {
  const missing = minPlayers - players.length;
  return (
    <>
      <section aria-labelledby="players-title" className="flex flex-col gap-3">
        <h2 id="players-title" className="text-xl font-bold">
          Juegan {players.length}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {players.map((player) => (
            <li
              key={player.playerId}
              className="rounded-full bg-night-soft px-4 py-2 text-base font-semibold ring-1 ring-cream/10"
            >
              {player.name}
            </li>
          ))}
        </ul>
        <p className="text-base text-cream/60">Juegan los que están en línea al iniciar.</p>
      </section>

      {isHost ? (
        <Button disabled={missing > 0} busy={starting} onClick={onStart}>
          {missing > 0
            ? `Faltan ${String(missing)} ${missing === 1 ? 'jugador' : 'jugadores'}`
            : 'Iniciar'}
        </Button>
      ) : (
        <p role="status" className="text-center text-lg text-cream/80">
          Esperando a que el host inicie…
        </p>
      )}
    </>
  );
}
