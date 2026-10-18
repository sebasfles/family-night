import { isOnline, type GameConfigs, type GameType, type RoomSnapshot } from '@family-night/shared';
import { api } from '../../api/client';
import { useRoomMutation } from '../../api/match';
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

  const update = useRoomMutation((cycles: number) =>
    api.updateConfig(code, { gameType, config: { cycles } }),
  );
  const start = useRoomMutation(() => api.startMatch(code, { gameType, config }));

  return (
    <>
      <section
        aria-labelledby={titleId}
        aria-busy={update.isPending || undefined}
        className="flex flex-col gap-5 rounded-3xl bg-night-soft p-5 ring-1 ring-cream/10"
      >
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-xl font-bold">
            Configuración
          </h2>
          {locked && <p className="text-base text-cream/70">Solo el host puede cambiarla.</p>}
        </div>

        <div className="flex flex-col gap-2">
          <p id="cycles-label" className="font-semibold">
            Vueltas
          </p>
          <div role="radiogroup" aria-labelledby="cycles-label" className="grid grid-cols-3 gap-2">
            {choices.map((cycles) => (
              <button
                key={cycles}
                type="button"
                role="radio"
                aria-checked={config.cycles === cycles}
                disabled={locked || update.isPending}
                onClick={() => {
                  if (config.cycles !== cycles) update.mutate(cycles);
                }}
                className={`min-h-12 rounded-2xl px-3 text-lg font-semibold focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:cursor-default ${
                  config.cycles === cycles
                    ? 'bg-moon text-night'
                    : 'bg-night text-cream/80 ring-1 ring-cream/15'
                }`}
              >
                {cycles}
              </button>
            ))}
          </div>
          <p className="text-base text-cream/70">
            Cada jugador {turn} {config.cycles === 1 ? 'una vez' : `${String(config.cycles)} veces`}
            {players.length > 0 &&
              `: ${String(rounds)} ${rounds === 1 ? 'ronda' : 'rondas'} con ${String(players.length)} en línea`}
            .
          </p>
        </div>
      </section>

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
