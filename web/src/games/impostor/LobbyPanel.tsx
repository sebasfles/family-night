import {
  isOnline,
  maxImpostors,
  MIN_IMPOSTOR_PLAYERS,
  type ImpostorConfig,
  type RoomSnapshot,
} from '@family-night/shared';
import { api } from '../../api/client';
import { useRoomMutation, useWordCategories } from '../../api/match';
import { Button } from '../../components/Button';
import { ConfigPanel } from './ConfigPanel';

interface LobbyPanelProps {
  code: string;
  snapshot: RoomSnapshot;
  isHost: boolean;
  nowMs: number;
}

export function LobbyPanel({ code, snapshot, isHost, nowMs }: LobbyPanelProps) {
  const categories = useWordCategories();
  const players = snapshot.members.filter((member) => isOnline(member.lastSeenAt, nowMs));
  const cap = Math.max(1, maxImpostors(players.length));
  const stored = snapshot.configs.IMPOSTOR;
  const config = { ...stored, impostorCount: Math.min(stored.impostorCount, cap) };
  const missing = MIN_IMPOSTOR_PLAYERS - players.length;

  const update = useRoomMutation((next: ImpostorConfig) =>
    api.updateConfig(code, { gameType: 'IMPOSTOR', config: next }),
  );
  const start = useRoomMutation(() => api.startMatch(code, { gameType: 'IMPOSTOR', config }));

  return (
    <>
      <ConfigPanel
        config={config}
        maxImpostors={cap}
        playerCount={players.length}
        categories={categories.data}
        editable={isHost}
        busy={update.isPending}
        onChange={(next) => {
          update.mutate(next);
        }}
      />

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
        <Button
          disabled={missing > 0}
          busy={start.isPending}
          onClick={() => {
            start.mutate();
          }}
        >
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
