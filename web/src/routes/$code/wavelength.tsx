import {
  isOnline,
  PRESENCE_RECOMPUTE_MS,
  type RoomSnapshot,
  type WavelengthPublic,
} from '@family-night/shared';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useMatchSecret, useRoomMutation, useRoomView } from '../../api/match';
import { useRoom } from '../../api/room';
import { MatchHeader } from '../../components/MatchHeader';
import { nameOf, usePhaseVibration, useRoundDraft } from '../../components/match';
import { useNow } from '../../components/useNow';
import { CluePhase } from '../../games/wavelength/CluePhase';
import { Final } from '../../games/wavelength/Final';
import { GuessPhase } from '../../games/wavelength/GuessPhase';
import { seatOf } from '../../games/wavelength/model';
import { useMyGuess } from '../../games/wavelength/myGuess';
import { RevealPhase } from '../../games/wavelength/RevealPhase';
import { useIdentity } from '../../identity/identity';

export const Route = createFileRoute('/$code/wavelength')({
  component: WavelengthScreen,
});

function WavelengthScreen() {
  const { code } = Route.useParams();
  const room = useRoomView(code);
  const served = useRoom(code).data?.snapshot.currentMatch;
  const match = room?.snapshot.currentMatch;
  if (!room || match?.gameType !== 'WAVELENGTH') return null;
  return (
    <WavelengthMatch
      key={match.matchId}
      code={code}
      snapshot={room.snapshot}
      match={match}
      clockOffsetMs={room.clockOffsetMs}
      servedStep={served ? `${served.phase}:${String(served.round)}` : ''}
    />
  );
}

interface WavelengthMatchProps {
  code: string;
  snapshot: RoomSnapshot;
  match: WavelengthPublic;
  clockOffsetMs: number;
  servedStep: string;
}

function WavelengthMatch({
  code,
  snapshot,
  match,
  clockOffsetMs,
  servedStep,
}: WavelengthMatchProps) {
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
  const [clueDraft, setClueDraft] = useRoundDraft(round);
  usePhaseVibration(servedStep);

  const clue = useRoomMutation(
    code,
    (text: string) => api.giveClue(code, matchId, { round, clue: text }),
    (text) => ({ kind: 'wavelength-clue', matchId, round, psychicId: selfId, clue: text }),
  );
  const commit = useRoomMutation(
    code,
    async (value: number) => {
      const response = await api.commitGuess(code, matchId, { round, value });
      rememberGuess(value);
      return response;
    },
    () => ({ kind: 'wavelength-commit', matchId, round, playerId: selfId }),
  );
  const close = useRoomMutation(code, () => api.closeGuessing(code, matchId, { round }));
  const skip = useRoomMutation(code, () => api.skipPsychic(code, matchId, { round }));
  const next = useRoomMutation(code, () => api.nextRound(code, matchId, { round }));
  const abort = useRoomMutation(code, () => api.abortMatch(code, matchId));
  const rematch = useRoomMutation(code, () => api.rematch(code, matchId));
  const lobby = useRoomMutation(code, () => api.backToLobby(code));

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
        badge={seat === 'SPECTATOR' && phase !== 'FINISHED' ? 'Espectador' : null}
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
          draft={clueDraft}
          skipping={skip.isPending}
          onDraft={setClueDraft}
          onClue={(text) => {
            clue.mutate(text);
          }}
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
          myGuess={commit.variables ?? myGuess}
          isHost={isHost}
          closing={close.isPending}
          onCommit={(value) => {
            commit.mutate(value);
          }}
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
