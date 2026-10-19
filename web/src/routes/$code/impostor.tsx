import type { ImpostorPublic, RoomSnapshot } from '@family-night/shared';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useMatchSecret, useRoomMutation, useRoomView } from '../../api/match';
import { useRoom } from '../../api/room';
import { usePhaseVibration } from '../../components/match';
import { Card } from '../../games/impostor/Card';
import { Final } from '../../games/impostor/Final';
import { MatchHeader } from '../../components/MatchHeader';
import { SpectatorNotice } from '../../components/SpectatorNotice';
import { impostorCountLabel, seatOf, type Seat } from '../../games/impostor/model';
import { useMyVote } from '../../games/impostor/myVote';
import { Reveal } from '../../games/impostor/Reveal';
import { TurnOrder } from '../../games/impostor/TurnOrder';
import { Voting } from '../../games/impostor/Voting';
import { useIdentity } from '../../identity/identity';
import { Enter } from '../../motion/motion';

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
  const room = useRoomView(code);
  const served = useRoom(code).data?.snapshot.currentMatch;
  const match = room?.snapshot.currentMatch;
  if (!room || match?.gameType !== 'IMPOSTOR') return null;
  return (
    <ImpostorMatch
      key={match.matchId}
      code={code}
      snapshot={room.snapshot}
      match={match}
      servedStep={served ? `${served.phase}:${String(served.round)}` : ''}
    />
  );
}

interface ImpostorMatchProps {
  code: string;
  snapshot: RoomSnapshot;
  match: ImpostorPublic;
  servedStep: string;
}

function ImpostorMatch({ code, snapshot, match, servedStep }: ImpostorMatchProps) {
  const identity = useIdentity();
  const selfId = identity.playerId;
  const seat = seatOf(match, selfId);
  const isHost = snapshot.hostId === selfId;
  const playing = match.status === 'PLAYING';
  const secret = useMatchSecret(code, match.matchId, null, seat !== 'SPECTATOR');
  const { data } = secret;
  const impostorSecret = data?.role === 'CIVILIAN' || data?.role === 'IMPOSTOR' ? data : undefined;
  const { matchId, round } = match;
  const [myVote, rememberVote] = useMyVote(matchId, round);
  usePhaseVibration(servedStep);

  const select = useRoomMutation(code, async (targetId: string) => {
    const response = await api.vote(code, matchId, { round, targetId, confirmed: false });
    rememberVote({ targetId, confirmed: false });
    return response;
  });
  const confirm = useRoomMutation(
    code,
    async (targetId: string) => {
      const response = await api.vote(code, matchId, { round, targetId, confirmed: true });
      rememberVote({ targetId, confirmed: true });
      return response;
    },
    (targetId) => ({ kind: 'impostor-confirm', matchId, round, voterId: selfId, targetId }),
  );
  const close = useRoomMutation(code, () => api.closeVoting(code, matchId, { round }));
  const next = useRoomMutation(code, () => api.nextRound(code, matchId, { round }));
  const abort = useRoomMutation(code, () => api.abortMatch(code, matchId));
  const rematch = useRoomMutation(code, () => api.rematch(code, matchId));
  const lobby = useRoomMutation(code, () => api.backToLobby(code));
  const chosen = confirm.variables ?? select.variables ?? myVote?.targetId ?? null;
  const selection = chosen !== null && match.order.includes(chosen) ? chosen : null;

  return (
    <Enter as="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6">
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

      {seat === 'SPECTATOR' && playing && <SpectatorNotice />}

      {seat !== 'SPECTATOR' && match.phase !== 'FINISHED' && <Card secret={impostorSecret} />}

      <Enter key={`${match.phase}-${String(match.round)}`} className="flex flex-col gap-6">
        {match.phase === 'VOTING' && (
          <>
            <TurnOrder order={match.order} members={snapshot.members} />
            <Voting
              match={match}
              members={snapshot.members}
              selfId={selfId}
              canVote={seat === 'PLAYER'}
              selection={selection}
              selectionGone={chosen !== null && selection === null}
              isHost={isHost}
              closing={close.isPending}
              onSelect={(targetId) => {
                select.mutate(targetId);
              }}
              onConfirm={(targetId) => {
                confirm.mutate(targetId);
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
      </Enter>
    </Enter>
  );
}
