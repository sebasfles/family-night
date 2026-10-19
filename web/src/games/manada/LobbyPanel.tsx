import {
  isOnline,
  MANADA_MAX_ROUNDS,
  MANADA_MIN_ROUNDS,
  MANADA_WIN_POINTS,
  MIN_MANADA_PLAYERS,
  type ManadaConfig,
  type ManadaGoal,
  type RoomSnapshot,
} from '@family-night/shared';
import { api } from '../../api/client';
import { useRoomMutation } from '../../api/match';
import { ConfigSection, Row, Segmented, StepButton } from '../../components/lobby/ConfigSection';
import { StartSection } from '../../components/lobby/StartSection';

interface LobbyPanelProps {
  code: string;
  snapshot: RoomSnapshot;
  isHost: boolean;
  nowMs: number;
}

const GOALS = [
  ['ROUNDS', 'Rondas'],
  ['POINTS', `${String(MANADA_WIN_POINTS)} puntos`],
] as const satisfies readonly (readonly [ManadaGoal, string])[];

export function LobbyPanel({ code, snapshot, isHost, nowMs }: LobbyPanelProps) {
  const players = snapshot.members.filter((member) => isOnline(member.lastSeenAt, nowMs));
  const config = snapshot.configs.MANADA;
  const locked = !isHost;

  const update = useRoomMutation(
    code,
    (next: ManadaConfig) => api.updateConfig(code, { gameType: 'MANADA', config: next }),
    (next) => ({ kind: 'config', request: { gameType: 'MANADA', config: next } }),
  );
  const start = useRoomMutation(code, () => api.startMatch(code, { gameType: 'MANADA', config }));
  const set = (patch: Partial<ManadaConfig>) => {
    update.mutate({ ...config, ...patch });
  };

  return (
    <>
      <ConfigSection titleId="manada-config-title" locked={locked}>
        <Segmented
          labelId="manada-goal-label"
          label="¿Hasta cuándo?"
          options={GOALS}
          value={config.goal}
          disabled={locked}
          onChange={(goal) => {
            set({ goal });
          }}
          className="grid-cols-2"
        />
        {config.goal === 'ROUNDS' ? (
          <Row
            label="Rondas"
            hint={`De ${String(MANADA_MIN_ROUNDS)} a ${String(MANADA_MAX_ROUNDS)}`}
          >
            <div className="flex items-center gap-2">
              <StepButton
                label="Una ronda menos"
                disabled={locked || config.rounds <= MANADA_MIN_ROUNDS}
                onClick={() => {
                  set({ rounds: config.rounds - 1 });
                }}
              >
                −
              </StepButton>
              <output
                aria-label="Rondas"
                className="w-10 text-center font-display text-3xl font-bold text-moon tabular-nums"
              >
                {config.rounds}
              </output>
              <StepButton
                label="Una ronda más"
                disabled={locked || config.rounds >= MANADA_MAX_ROUNDS}
                onClick={() => {
                  set({ rounds: config.rounds + 1 });
                }}
              >
                +
              </StepButton>
            </div>
          </Row>
        ) : null}
        <p className="text-base text-cream/70">
          {config.goal === 'ROUNDS'
            ? 'Gana quien sume más al final, sin la vaca rosa.'
            : `Gana quien llegue primero a ${String(MANADA_WIN_POINTS)} puntos sin la vaca rosa.`}
        </p>
      </ConfigSection>

      <StartSection
        players={players}
        minPlayers={MIN_MANADA_PLAYERS}
        isHost={isHost}
        starting={start.isPending}
        onStart={() => {
          start.mutate();
        }}
      />
    </>
  );
}
