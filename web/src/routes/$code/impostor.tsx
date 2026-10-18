import {
  isOnline,
  PRESENCE_RECOMPUTE_MS,
  type ImpostorPublic,
  type RoomSnapshot,
} from '@family-night/shared';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useMatchSecret, useRoomMutation } from '../../api/match';
import { useRoom } from '../../api/room';
import { usePhaseVibration } from '../../components/match';
import { useNow } from '../../components/useNow';
import { Card } from '../../games/impostor/Card';
import { Final } from '../../games/impostor/Final';
import { LastChance } from '../../games/impostor/LastChance';
import { MatchHeader } from '../../components/MatchHeader';
import { impostorCountLabel, seatOf, type Seat } from '../../games/impostor/model';
import { useMyVote } from '../../games/impostor/myVote';
import { Reveal } from '../../games/impostor/Reveal';
import { TurnOrder } from '../../games/impostor/TurnOrder';
import { Voting } from '../../games/impostor/Voting';
import { useIdentity } from '../../identity/identity';

export const Route = createFileRoute('/$code/impostor')({
  component: ImpostorScreen,
});

const seatBadges: Record<Seat, string | null> = {
  PLAYER: null,
  ELIMINATED: 'Eliminado',
  SPECTATOR: 'Espectador',
};

function ImpostorScreen() {
  const { code } = Route.useParams();
  const room = useRoom(code).data;
  const match = room?.snapshot.currentMatch;
  if (!room || match?.gameType !== 'IMPOSTOR') return null;
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

function ImpostorMatch({ code, snapshot, match, clockOffsetMs }: ImpostorMatchProps) {
  const identity = useIdentity();
  const now = useNow(PRESENCE_RECOMPUTE_MS);
  const selfId = identity.playerId;
  const seat = seatOf(match, selfId);
  const isHost = snapshot.hostId === selfId;
  const playing = match.status === 'PLAYING';
  const secret = useMatchSecret(code, match.matchId, null, seat !== 'SPECTATOR');
  const { data } = secret;
  const impostorSecret = data?.role === 'CIVILIAN' || data?.role === 'IMPOSTOR' ? data : undefined;
  const { matchId, round } = match;
  const [myVote, rememberVote] = useMyVote(matchId, round);
  usePhaseVibration(`${match.phase}:${String(match.round)}`);

  const vote = useRoomMutation(async (targetId: string) => {
    const response = await api.vote(code, matchId, { round, targetId });
    rememberVote(targetId);
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
        subtitle={
          match.phase === 'FINISHED'
            ? `${String(match.round)} ${match.round === 1 ? 'ronda' : 'rondas'}, ${impostorCountLabel(match.config.impostorCount)}`
            : `${impostorCountLabel(match.config.impostorCount)} en juego`
        }
        badge={seatBadges[seat]}
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

      {seat !== 'SPECTATOR' && match.phase !== 'FINISHED' && <Card secret={impostorSecret} />}

      {match.phase === 'VOTING' && (
        <>
          <TurnOrder order={match.order} members={snapshot.members} />
          <Voting
            match={match}
            members={snapshot.members}
            selfId={selfId}
            canVote={seat === 'PLAYER'}
            myVote={myVote}
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
