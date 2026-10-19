import { isOnline, type GameConfigs, type GameType, type RoomSnapshot } from '@family-night/shared';
import { api } from '../../api/client';
import { useRoomMutation } from '../../api/match';
import { ConfigSection, Segmented } from './ConfigSection';
import { StartSection } from './StartSection';

export type CyclesGame = {
  [G in GameType]: GameConfigs[G] extends { cycles: number } ? G : never;
}[GameType];

interface CyclesPanelProps {
  code: string;
  snapshot: RoomSnapshot;
  isHost: boolean;
  nowMs: number;
  gameType: CyclesGame;
  minPlayers: number;
  maxCycles: number;
  turn: string;
}

export function CyclesPanel({
  code,
  snapshot,
  isHost,
  nowMs,
  gameType,
  minPlayers,
  maxCycles,
  turn,
}: CyclesPanelProps) {
  const players = snapshot.members.filter((member) => isOnline(member.lastSeenAt, nowMs));
  const config = snapshot.configs[gameType];
  const rounds = config.cycles * players.length;
  const locked = !isHost;
  const titleId = `${gameType.toLowerCase()}-config-title`;
  const choices = Array.from({ length: maxCycles }, (_, i) => i + 1);

  const update = useRoomMutation(
    code,
    (cycles: number) => api.updateConfig(code, { gameType, config: { cycles } }),
    (cycles) => ({ kind: 'config', request: { gameType, config: { cycles } } }),
  );
  const start = useRoomMutation(code, () => api.startMatch(code, { gameType, config }));

  return (
    <>
      <ConfigSection titleId={titleId} locked={locked}>
        <div className="flex flex-col gap-2">
          <Segmented
            labelId={`${titleId}-cycles`}
            label="Vueltas"
            options={choices.map((cycles) => [cycles, String(cycles)] as const)}
            value={config.cycles}
            disabled={locked}
            onChange={(cycles) => {
              update.mutate(cycles);
            }}
            className="grid-cols-3"
          />
          <p className="text-base text-cream/70">
            Cada jugador {turn} {config.cycles === 1 ? 'una vez' : `${String(config.cycles)} veces`}
            {players.length > 0 &&
              `: ${String(rounds)} ${rounds === 1 ? 'ronda' : 'rondas'} con ${String(players.length)} en línea`}
            .
          </p>
        </div>
      </ConfigSection>

      <StartSection
        players={players}
        minPlayers={minPlayers}
        isHost={isHost}
        starting={start.isPending}
        onStart={() => {
          start.mutate();
        }}
      />
    </>
  );
}
