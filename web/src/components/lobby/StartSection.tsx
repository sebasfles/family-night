import type { RoomMember } from '@family-night/shared';
import { Avatar } from '../Avatar';
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
    <section aria-labelledby="players-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h2 id="players-title" className="text-2xl font-bold">
          Juegan {players.length}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {players.map((player) => (
            <li
              key={player.playerId}
              className="flex items-center gap-2 rounded-full bg-night-soft py-1 pr-4 pl-1 text-base font-bold ring-1 ring-cream/8"
            >
              <Avatar playerId={player.playerId} name={player.name} className="size-8 text-sm" />
              {player.name}
            </li>
          ))}
        </ul>
        <p className="text-base text-cream/60">Juegan los que están en línea al iniciar.</p>
      </div>

      {isHost ? (
        <Button
          disabled={missing > 0}
          busy={starting}
          onClick={onStart}
          className="min-h-14 text-xl"
        >
          {missing > 0
            ? `Faltan ${String(missing)} ${missing === 1 ? 'jugador' : 'jugadores'}`
            : 'Iniciar'}
        </Button>
      ) : (
        <p
          role="status"
          className="flex items-center justify-center gap-3 rounded-full bg-cream/5 px-5 py-3 text-center text-lg text-cream/80"
        >
          <span aria-hidden="true" className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-2 rounded-full bg-moon motion-safe:animate-pulse"
                style={{ animationDelay: `${String(dot * 200)}ms` }}
              />
            ))}
          </span>
          Esperando a que el host inicie…
        </p>
      )}
    </section>
  );
}
