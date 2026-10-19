import { type ManadaPublic, type RoomSnapshot } from '@family-night/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useMatchSecret, useRoomMutation, useRoomView } from '../../api/match';
import { useRoom } from '../../api/room';
import { MatchHeader } from '../../components/MatchHeader';
import { SpectatorNotice } from '../../components/SpectatorNotice';
import { usePhaseVibration, useRoundDraft } from '../../components/match';
import { AnswerPhase } from '../../games/manada/AnswerPhase';
import { Final } from '../../games/manada/Final';
import { goalLabel, roundsLabel, seatOf } from '../../games/manada/model';
import { RevealPhase } from '../../games/manada/RevealPhase';
import { useIdentity } from '../../identity/identity';
import { Enter } from '../../motion/motion';

export const Route = createFileRoute('/$code/manada')({
  component: ManadaScreen,
});

function ManadaScreen() {
  const { code } = Route.useParams();
  const room = useRoomView(code);
  const served = useRoom(code).data?.snapshot.currentMatch;
  const match = room?.snapshot.currentMatch;
  if (!room || match?.gameType !== 'MANADA') return null;
  return (
    <ManadaMatch
      key={match.matchId}
      code={code}
      snapshot={room.snapshot}
      match={match}
      servedStep={served ? `${served.phase}:${String(served.round)}` : ''}
    />
  );
}

interface ManadaMatchProps {
  code: string;
  snapshot: RoomSnapshot;
  match: ManadaPublic;
  servedStep: string;
}

function ManadaMatch({ code, snapshot, match, servedStep }: ManadaMatchProps) {
  const identity = useIdentity();
  const queryClient = useQueryClient();
  const selfId = identity.playerId;
  const seat = seatOf(match, selfId);
  const isHost = snapshot.hostId === selfId;
  const playing = match.status === 'PLAYING';
  const { matchId, round, phase } = match;
  const secret = useMatchSecret(
    code,
    matchId,
    round,
    seat === 'PLAYER' && playing && phase === 'ANSWER',
    phase,
  );
  const mine = secret.data?.role === 'ANSWERER' ? secret.data : undefined;
  const [draft, setDraft] = useRoundDraft(round);
  usePhaseVibration(servedStep);

  const answer = useRoomMutation(
    code,
    async (text: string) => {
      const response = await api.answer(code, matchId, { round, answer: text });
      await queryClient.invalidateQueries({ queryKey: ['match-secret', matchId, round, 'ANSWER'] });
      return response;
    },
    () => ({ kind: 'manada-answer', matchId, round, playerId: selfId }),
  );
  const close = useRoomMutation(code, () => api.closeAnswers(code, matchId, { round }));
  const merge = useRoomMutation(
    code,
    (groupIds: [string, string]) => api.mergeGroups(code, matchId, { round, groupIds }),
    (groupIds) => ({ kind: 'manada-merge', matchId, round, groupIds }),
  );
  const split = useRoomMutation(
    code,
    (groupId: string) => api.splitGroup(code, matchId, { round, groupId }),
    (groupId) => ({ kind: 'manada-split', matchId, round, groupId }),
  );
  const next = useRoomMutation(code, () => api.nextRound(code, matchId, { round }));
  const abort = useRoomMutation(code, () => api.abortMatch(code, matchId));
  const rematch = useRoomMutation(code, () => api.rematch(code, matchId));
  const lobby = useRoomMutation(code, () => api.backToLobby(code));

  return (
    <Enter as="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6">
      <MatchHeader
        round={round}
        finished={phase === 'FINISHED'}
        subtitle={
          phase === 'FINISHED'
            ? `La manada, ${roundsLabel(round)}`
            : `La manada, ${goalLabel(match.config)}`
        }
        badge={seat === 'SPECTATOR' && phase !== 'FINISHED' ? 'Espectador' : null}
        canAbort={isHost && playing}
        aborting={abort.isPending}
        onAbort={() => {
          abort.mutate();
        }}
      />

      {seat === 'SPECTATOR' && playing && <SpectatorNotice />}

      <Enter key={`${phase}-${String(round)}`} className="flex flex-col gap-6">
        {phase === 'ANSWER' && (
          <AnswerPhase
            match={match}
            seat={seat}
            answered={match.answeredPlayerIds.includes(selfId)}
            myAnswer={mine?.answer ?? answer.variables ?? null}
            isHost={isHost}
            draft={draft}
            closing={close.isPending}
            onDraft={setDraft}
            onAnswer={(text) => {
              answer.mutate(text);
            }}
            onClose={() => {
              close.mutate();
            }}
          />
        )}

        {phase === 'REVEAL' && (
          <RevealPhase
            key={round}
            match={match}
            members={snapshot.members}
            selfId={selfId}
            isHost={isHost}
            advancing={next.isPending}
            onMerge={(groupIds) => {
              merge.mutate(groupIds);
            }}
            onSplit={(groupId) => {
              split.mutate(groupId);
            }}
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
      </Enter>
    </Enter>
  );
}
