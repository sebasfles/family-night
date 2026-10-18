import {
  isOnline,
  PRESENCE_RECOMPUTE_MS,
  type ImpostorPublic,
  type RoomSnapshot,
} from '@family-night/shared';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useMatchSecret, useRoomMutation } from '../../api/match';
import { useRoom } from '../../api/room';
import { useNow } from '../../components/useNow';
import { Card } from '../../games/impostor/Card';
import { Final } from '../../games/impostor/Final';
import { LastChance } from '../../games/impostor/LastChance';
import { MatchHeader } from '../../games/impostor/MatchHeader';
import { seatOf, vibrate } from '../../games/impostor/model';
import { Reveal } from '../../games/impostor/Reveal';
import { TurnOrder } from '../../games/impostor/TurnOrder';
import { Voting } from '../../games/impostor/Voting';
import { useIdentity } from '../../identity/identity';

export const Route = createFileRoute('/$code/impostor')({
  component: ImpostorScreen,
});

function ImpostorScreen() {
  const { code } = Route.useParams();
  const room = useRoom(code).data;
  const match = room?.snapshot.currentMatch;
  if (!room || !match) return null;
  return (
    <ImpostorMatch
      key={match.matchId}
      code={code}
      snapshot={room.snapshot}
      match={match}
      clockOffsetMs={room.clockOffsetMs}
    />
  );
}

interface ImpostorMatchProps {
  code: string;
  snapshot: RoomSnapshot;
  match: ImpostorPublic;
  clockOffsetMs: number;
}

function usePhaseVibration(match: ImpostorPublic) {
  const step = `${match.phase}:${String(match.round)}`;
  const previous = useRef(step);
  useEffect(() => {
    if (previous.current !== step) vibrate();
    previous.current = step;
  }, [step]);
}

function ImpostorMatch({ code, snapshot, match, clockOffsetMs }: ImpostorMatchProps) {
  const identity = useIdentity();
  const now = useNow(PRESENCE_RECOMPUTE_MS);
  const selfId = identity.playerId;
  const seat = seatOf(match, selfId);
  const isHost = snapshot.hostId === selfId;
  const playing = match.status === 'PLAYING';
  const secret = useMatchSecret(code, match.matchId, seat !== 'SPECTATOR');
  const [myVote, setMyVote] = useState<{ round: number; targetId: string } | null>(null);
  const { matchId, round } = match;
  usePhaseVibration(match);

  const vote = useRoomMutation(async (targetId: string) => {
    const response = await api.vote(code, matchId, { round, targetId });
    setMyVote({ round, targetId });
    return response;
  });
  const close = useRoomMutation(() => api.closeVoting(code, matchId, { round }));
  const next = useRoomMutation(() => api.nextRound(code, matchId, { round }));
  const guess = useRoomMutation((option: string) => api.guess(code, matchId, { option }));
  const skip = useRoomMutation(() => api.skipGuess(code, matchId));
  const abort = useRoomMutation(() => api.abortMatch(code, matchId));
  const rematch = useRoomMutation(() => api.rematch(code, matchId));
  const lobby = useRoomMutation(() => api.backToLobby(code));

  const guesser = snapshot.members.find((member) => member.playerId === match.guess?.guesserId);
  const guesserOnline = guesser ? isOnline(guesser.lastSeenAt, now + clockOffsetMs) : false;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6">
      <MatchHeader
        round={match.round}
        finished={match.phase === 'FINISHED'}
        impostorCount={match.config.impostorCount}
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

      {seat !== 'SPECTATOR' && match.phase !== 'FINISHED' && (
        <Card secret={secret.data ?? undefined} />
      )}

      {match.phase === 'VOTING' && (
        <>
          <TurnOrder order={match.order} members={snapshot.members} />
          <Voting
            match={match}
            members={snapshot.members}
            selfId={selfId}
            canVote={seat === 'PLAYER'}
            myVote={myVote?.round === match.round ? myVote.targetId : null}
            pendingTarget={vote.isPending ? vote.variables : null}
            isHost={isHost}
            closing={close.isPending}
            onVote={(targetId) => {
              vote.mutate(targetId);
            }}
            onClose={() => {
              close.mutate();
            }}
          />
        </>
      )}

      {match.phase === 'REVEAL' && (
        <Reveal
          match={match}
          members={snapshot.members}
          isHost={isHost}
          busy={next.isPending}
          onNext={() => {
            next.mutate();
          }}
        />
      )}

      {match.phase === 'IMPOSTOR_GUESS' && (
        <LastChance
          match={match}
          members={snapshot.members}
          selfId={selfId}
          isHost={isHost}
          guesserOnline={guesserOnline}
          busy={guess.isPending || skip.isPending}
          onGuess={(option) => {
            guess.mutate(option);
          }}
          onSkip={() => {
            skip.mutate();
          }}
        />
      )}

      {match.phase === 'FINISHED' && (
        <Final
          match={match}
          members={snapshot.members}
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
