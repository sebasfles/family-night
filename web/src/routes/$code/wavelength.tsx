import {
  isOnline,
  PRESENCE_RECOMPUTE_MS,
  type RoomSnapshot,
  type WavelengthPublic,
} from '@family-night/shared';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useMatchSecret, useRoomMutation } from '../../api/match';
import { useRoom } from '../../api/room';
import { nameOf, usePhaseVibration } from '../../components/match';
import { useNow } from '../../components/useNow';
import { CluePhase } from '../../games/wavelength/CluePhase';
import { Final } from '../../games/wavelength/Final';
import { GuessPhase } from '../../games/wavelength/GuessPhase';
import { MatchHeader } from '../../games/wavelength/MatchHeader';
import { seatOf } from '../../games/wavelength/model';
import { useMyGuess } from '../../games/wavelength/myGuess';
import { RevealPhase } from '../../games/wavelength/RevealPhase';
import { useIdentity } from '../../identity/identity';

export const Route = createFileRoute('/$code/wavelength')({
  component: WavelengthScreen,
});

function WavelengthScreen() {
  const { code } = Route.useParams();
  const room = useRoom(code).data;
  const match = room?.snapshot.currentMatch;
  if (!room || match?.gameType !== 'WAVELENGTH') return null;
  return (
    <WavelengthMatch
      key={match.matchId}
      code={code}
      snapshot={room.snapshot}
      match={match}
      clockOffsetMs={room.clockOffsetMs}
    />
  );
}

interface WavelengthMatchProps {
  code: string;
  snapshot: RoomSnapshot;
  match: WavelengthPublic;
  clockOffsetMs: number;
}

function WavelengthMatch({ code, snapshot, match, clockOffsetMs }: WavelengthMatchProps) {
  const identity = useIdentity();
  const now = useNow(PRESENCE_RECOMPUTE_MS);
  const selfId = identity.playerId;
  const seat = seatOf(match, selfId);
  const isHost = snapshot.hostId === selfId;
  const playing = match.status === 'PLAYING';
  const { matchId, round, phase } = match;
  const hidden = phase === 'CLUE' || phase === 'GUESS';
  const secret = useMatchSecret(code, matchId, round, seat === 'PSYCHIC' && playing && hidden);
  const target = secret.data?.role === 'PSYCHIC' ? secret.data.target : undefined;
  const [myGuess, rememberGuess] = useMyGuess(matchId, round);
  usePhaseVibration(`${phase}:${String(round)}`);

  const clue = useRoomMutation((text: string) =>
    api.giveClue(code, matchId, { round, clue: text }),
  );
  const commit = useRoomMutation(async (value: number) => {
    const response = await api.commitGuess(code, matchId, { round, value });
    rememberGuess(value);
    return response;
  });
  const close = useRoomMutation(() => api.closeGuessing(code, matchId, { round }));
  const skip = useRoomMutation(() => api.skipPsychic(code, matchId, { round }));
  const next = useRoomMutation(() => api.nextRound(code, matchId, { round }));
  const abort = useRoomMutation(() => api.abortMatch(code, matchId));
  const rematch = useRoomMutation(() => api.rematch(code, matchId));
  const lobby = useRoomMutation(() => api.backToLobby(code));

  const psychic = snapshot.members.find((member) => member.playerId === match.psychicId);
  const psychicOnline = psychic ? isOnline(psychic.lastSeenAt, now + clockOffsetMs) : false;
  const rounds = match.round === 1 ? '1 ronda' : `${String(match.round)} rondas`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6">
      <MatchHeader
        round={round}
        finished={phase === 'FINISHED'}
        subtitle={
          phase === 'FINISHED'
            ? `Wavelength, ${rounds}`
            : seat === 'PSYCHIC'
              ? 'Psíquico: tú'
              : `Psíquico: ${nameOf(snapshot.members, match.psychicId)}`
        }
        seat={seat}
        canAbort={isHost && playing}
        aborting={abort.isPending}
        onAbort={() => {
          abort.mutate();
        }}
      />

      {seat === 'SPECTATOR' && playing && (
        <p
          role="status"
          className="rounded-3xl bg-night-soft p-4 text-center text-lg ring-1 ring-cream/10"
        >
          Partida en curso, juegas en la siguiente
        </p>
      )}

      {phase === 'CLUE' && (
        <CluePhase
          key={round}
          match={match}
          members={snapshot.members}
          seat={seat}
          target={target}
          isHost={isHost}
          psychicOnline={psychicOnline}
          sending={clue.isPending}
          skipping={skip.isPending}
          onClue={(text) => clue.mutateAsync(text)}
          onSkip={() => {
            skip.mutate();
          }}
        />
      )}

      {phase === 'GUESS' && (
        <GuessPhase
          key={round}
          match={match}
          members={snapshot.members}
          seat={seat}
          selfId={selfId}
          target={target}
          myGuess={myGuess}
          isHost={isHost}
          committing={commit.isPending}
          closing={close.isPending}
          onCommit={(value) => commit.mutateAsync(value)}
          onClose={() => {
            close.mutate();
          }}
        />
      )}

      {phase === 'REVEAL' && (
        <RevealPhase
          match={match}
          members={snapshot.members}
          selfId={selfId}
          isHost={isHost}
          busy={next.isPending}
          onNext={() => {
            next.mutate();
          }}
        />
      )}

      {phase === 'FINISHED' && (
        <Final
          match={match}
          members={snapshot.members}
          selfId={selfId}
          isHost={isHost}
          rematching={rematch.isPending}
          leaving={lobby.isPending}
          onRematch={() => {
            rematch.mutate();
          }}
          onLobby={() => {
            lobby.mutate();
          }}
        />
      )}
    </main>
  );
}
