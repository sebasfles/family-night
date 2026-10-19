import {
  isOnline,
  PRESENCE_RECOMPUTE_MS,
  type JustOnePublic,
  type RoomSnapshot,
} from '@family-night/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useMatchSecret, useRoomMutation, useRoomView } from '../../api/match';
import { useRoom } from '../../api/room';
import { MatchHeader } from '../../components/MatchHeader';
import { SpectatorNotice } from '../../components/SpectatorNotice';
import { nameOf, usePhaseVibration, useRoundDraft } from '../../components/match';
import { useNow } from '../../components/useNow';
import { CluePhase } from '../../games/justone/CluePhase';
import { Final } from '../../games/justone/Final';
import { GuessPhase } from '../../games/justone/GuessPhase';
import { roundsLabel, seatOf } from '../../games/justone/model';
import { RevealPhase } from '../../games/justone/RevealPhase';
import { ReviewPhase } from '../../games/justone/ReviewPhase';
import { SkipGuesser } from '../../games/justone/SkipGuesser';
import { useIdentity } from '../../identity/identity';
import { Enter } from '../../motion/motion';

export const Route = createFileRoute('/$code/justone')({
  component: JustOneScreen,
});

function JustOneScreen() {
  const { code } = Route.useParams();
  const room = useRoomView(code);
  const served = useRoom(code).data?.snapshot.currentMatch;
  const match = room?.snapshot.currentMatch;
  if (!room || match?.gameType !== 'JUST_ONE') return null;
  return (
    <JustOneMatch
      key={match.matchId}
      code={code}
      snapshot={room.snapshot}
      match={match}
      clockOffsetMs={room.clockOffsetMs}
      servedStep={served ? `${served.phase}:${String(served.round)}` : ''}
    />
  );
}

interface JustOneMatchProps {
  code: string;
  snapshot: RoomSnapshot;
  match: JustOnePublic;
  clockOffsetMs: number;
  servedStep: string;
}

function JustOneMatch({ code, snapshot, match, clockOffsetMs, servedStep }: JustOneMatchProps) {
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
  const [clueDraft, setClueDraft] = useRoundDraft(round);
  const [guessDraft, setGuessDraft] = useRoundDraft(round);
  usePhaseVibration(servedStep);

  const clue = useRoomMutation(
    code,
    async (text: string) => {
      const response = await api.writeClue(code, matchId, { round, clue: text });
      await queryClient.invalidateQueries({ queryKey: ['match-secret', matchId, round, 'CLUE'] });
      return response;
    },
    () => ({ kind: 'justone-clue', matchId, round, playerId: selfId }),
  );
  const close = useRoomMutation(code, () => api.closeClues(code, matchId, { round }));
  const toggle = useRoomMutation(
    code,
    ({ authorId, cancelled }: { authorId: string; cancelled: boolean }) =>
      api.cancelClue(code, matchId, { round, authorId, cancelled }),
    ({ authorId, cancelled }) => ({
      kind: 'justone-cancel',
      matchId,
      round,
      playerId: selfId,
      authorId,
      cancelled,
    }),
  );
  const show = useRoomMutation(code, () => api.showClues(code, matchId, { round }));
  const guess = useRoomMutation(code, (text: string | null) =>
    api.guessWord(code, matchId, { round, guess: text }),
  );
  const accept = useRoomMutation(code, () => api.acceptGuess(code, matchId, { round }));
  const skip = useRoomMutation(code, () => api.skipGuesser(code, matchId, { round }));
  const next = useRoomMutation(code, () => api.nextRound(code, matchId, { round }));
  const abort = useRoomMutation(code, () => api.abortMatch(code, matchId));
  const rematch = useRoomMutation(code, () => api.rematch(code, matchId));
  const lobby = useRoomMutation(code, () => api.backToLobby(code));

  const guesserName = nameOf(snapshot.members, match.guesserId);
  const guesser = snapshot.members.find((member) => member.playerId === match.guesserId);
  const guesserOnline = guesser ? isOnline(guesser.lastSeenAt, now + clockOffsetMs) : false;
  const canSkip = isHost && playing && hidden && seat !== 'GUESSER' && !guesserOnline;

  return (
    <Enter as="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6">
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
        badge={seat === 'SPECTATOR' && phase !== 'FINISHED' ? 'Espectador' : null}
        canAbort={isHost && playing}
        aborting={abort.isPending}
        onAbort={() => {
          abort.mutate();
        }}
      />

      {seat === 'SPECTATOR' && playing && <SpectatorNotice />}

      <Enter key={`${phase}-${String(round)}`} className="flex flex-col gap-6">
        {phase === 'CLUE' && (
          <CluePhase
            key={round}
            match={match}
            members={snapshot.members}
            seat={seat}
            word={word?.word}
            committed={match.committedPlayerIds.includes(selfId)}
            myClue={word?.clue ?? clue.variables ?? null}
            isHost={isHost}
            draft={clueDraft}
            closing={close.isPending}
            onDraft={setClueDraft}
            onClue={(text) => {
              clue.mutate(text);
            }}
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
            draft={guessDraft}
            sent={guess.isPending ? (guess.variables ?? null) : undefined}
            onDraft={setGuessDraft}
            onGuess={(text) => {
              guess.mutate(text);
            }}
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
            selfId={selfId}
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
      </Enter>
    </Enter>
  );
}
