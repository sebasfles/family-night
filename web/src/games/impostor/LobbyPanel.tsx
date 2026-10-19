import {
  isOnline,
  maxImpostors,
  MIN_IMPOSTOR_PLAYERS,
  type ImpostorConfig,
  type RoomSnapshot,
} from '@family-night/shared';
import { api } from '../../api/client';
import { useRoomMutation, useWordCategories } from '../../api/match';
import { StartSection } from '../../components/lobby/StartSection';
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

  const update = useRoomMutation(
    code,
    (next: ImpostorConfig) => api.updateConfig(code, { gameType: 'IMPOSTOR', config: next }),
    (next) => ({ kind: 'config', request: { gameType: 'IMPOSTOR', config: next } }),
  );
  const start = useRoomMutation(code, () => api.startMatch(code, { gameType: 'IMPOSTOR', config }));

  return (
    <>
      <ConfigPanel
        config={config}
        maxImpostors={cap}
        playerCount={players.length}
        categories={categories.data}
        editable={isHost}
        onChange={(next) => {
          update.mutate(next);
        }}
      />

      <StartSection
        players={players}
        minPlayers={MIN_IMPOSTOR_PLAYERS}
        isHost={isHost}
        starting={start.isPending}
        onStart={() => {
          start.mutate();
        }}
      />
    </>
  );
}
