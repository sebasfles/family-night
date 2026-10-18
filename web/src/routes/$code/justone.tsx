import {
  isOnline,
  PRESENCE_RECOMPUTE_MS,
  type JustOnePublic,
  type RoomSnapshot,
} from '@family-night/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useMatchSecret, useRoomMutation } from '../../api/match';
import { useRoom } from '../../api/room';
import { nameOf, usePhaseVibration } from '../../components/match';
import { useNow } from '../../components/useNow';
import { CluePhase } from '../../games/justone/CluePhase';
import { Final } from '../../games/justone/Final';
import { GuessPhase } from '../../games/justone/GuessPhase';
import { MatchHeader } from '../../games/justone/MatchHeader';
import { roundsLabel, seatOf } from '../../games/justone/model';
import { RevealPhase } from '../../games/justone/RevealPhase';
import { ReviewPhase } from '../../games/justone/ReviewPhase';
import { SkipGuesser } from '../../games/justone/SkipGuesser';
import { useIdentity } from '../../identity/identity';

export const Route = createFileRoute('/$code/justone')({
  component: JustOneScreen,
});

function JustOneScreen() {
  const { code } = Route.useParams();
  const room = useRoom(code).data;
  const match = room?.snapshot.currentMatch;
  if (!room || match?.gameType !== 'JUST_ONE') return null;
  return (
    <JustOneMatch
      key={match.matchId}
      code={code}
      snapshot={room.snapshot}
      match={match}
      clockOffsetMs={room.clockOffsetMs}
    />
  );
}

interface JustOneMatchProps {
  code: string;
  snapshot: RoomSnapshot;
  match: JustOnePublic;
  clockOffsetMs: number;
}

function JustOneMatch({ code, snapshot, match, clockOffsetMs }: JustOneMatchProps) {
  const identity = useIdentity();
  const queryClient = useQueryClient();
  const now = useNow(PRESENCE_RECOMPUTE_MS);
  const selfId = identity.playerId;
  const seat = seatOf(match, selfId);
  const isHost = snapshot.hostId === selfId;
  const playing = match.status === 'PLAYING';
  const { matchId, round, phase } = match;
  const hidden = phase === 'CLUE' || phase === 'REVIEW' || phase === 'GUESS';
  const secret = useMatchSecret(
    code,
    matchId,
    round,
    seat === 'CLUE_GIVER' && playing && hidden,
    phase,
  );
  const word = secret.data?.role === 'CLUE_GIVER' ? secret.data : undefined;
  usePhaseVibration(`${phase}:${String(round)}`);

  const clue = useRoomMutation(async (text: string) => {
    const response = await api.writeClue(code, matchId, { round, clue: text });
    await queryClient.invalidateQueries({ queryKey: ['match-secret', matchId, round, 'CLUE'] });
    return response;
  });
  const close = useRoomMutation(() => api.closeClues(code, matchId, { round }));
  const toggle = useRoomMutation(
    ({ authorId, cancelled }: { authorId: string; cancelled: boolean }) =>
      api.cancelClue(code, matchId, { round, authorId, cancelled }),
  );
  const show = useRoomMutation(() => api.showClues(code, matchId, { round }));
  const guess = useRoomMutation((text: string | null) =>
    api.guessWord(code, matchId, { round, guess: text }),
  );
  const accept = useRoomMutation(() => api.acceptGuess(code, matchId, { round }));
  const skip = useRoomMutation(() => api.skipGuesser(code, matchId, { round }));
  const next = useRoomMutation(() => api.nextRound(code, matchId, { round }));
  const abort = useRoomMutation(() => api.abortMatch(code, matchId));
  const rematch = useRoomMutation(() => api.rematch(code, matchId));
  const lobby = useRoomMutation(() => api.backToLobby(code));

  const guesserName = nameOf(snapshot.members, match.guesserId);
  const guesser = snapshot.members.find((member) => member.playerId === match.guesserId);
  const guesserOnline = guesser ? isOnline(guesser.lastSeenAt, now + clockOffsetMs) : false;
  const canSkip = isHost && playing && hidden && seat !== 'GUESSER' && !guesserOnline;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6">
      <MatchHeader
        round={round}
        finished={phase === 'FINISHED'}
        subtitle={
          phase === 'FINISHED'
            ? `Just One, ${roundsLabel(round)}`
            : seat === 'GUESSER'
              ? 'Adivinas tú'
              : `Adivina: ${guesserName}`
        }
        spectator={seat === 'SPECTATOR'}
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
          word={word?.word}
          committed={match.committedPlayerIds.includes(selfId)}
          myClue={word?.clue ?? null}
          isHost={isHost}
          sending={clue.isPending}
          closing={close.isPending}
          onClue={(text) => clue.mutateAsync(text)}
          onClose={() => {
            close.mutate();
          }}
        />
      )}

      {phase === 'REVIEW' && (
        <ReviewPhase
          match={match}
          members={snapshot.members}
          seat={seat}
          word={word?.word}
          clues={word?.clues}
          isHost={isHost}
          toggling={toggle.isPending ? toggle.variables.authorId : null}
          showing={show.isPending}
          onToggle={(authorId, cancelled) => {
            toggle.mutate({ authorId, cancelled });
          }}
          onShow={() => {
            show.mutate();
          }}
        />
      )}

      {phase === 'GUESS' && (
        <GuessPhase
          key={round}
          match={match}
          members={snapshot.members}
          seat={seat}
          word={word?.word}
          guessing={guess.isPending}
          onGuess={(text) => guess.mutateAsync(text)}
        />
      )}

      {canSkip && (
        <SkipGuesser
          guesser={guesserName}
          skipping={skip.isPending}
          onSkip={() => {
            skip.mutate();
          }}
        />
      )}

      {phase === 'REVEAL' && (
        <RevealPhase
          match={match}
          members={snapshot.members}
          isHost={isHost}
          accepting={accept.isPending}
          advancing={next.isPending}
          onAccept={() => {
            accept.mutate();
          }}
          onNext={() => {
            next.mutate();
          }}
        />
      )}

      {phase === 'FINISHED' && (
        <Final
          match={match}
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
