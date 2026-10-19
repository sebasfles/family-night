import type { JustOneClue, JustOnePublic, RoomMember } from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import type { Seat } from './model';
import { Waiting } from '../../components/Waiting';
import { Stagger, StaggerItem } from '../../motion/motion';
import { ClueCard } from './ClueCard';
import { WordCard } from './WordCard';

interface ReviewPhaseProps {
  match: JustOnePublic;
  members: RoomMember[];
  seat: Seat;
  word: string | undefined;
  clues: JustOneClue[] | undefined;
  isHost: boolean;
  showing: boolean;
  onToggle: (authorId: string, cancelled: boolean) => void;
  onShow: () => void;
}

export function ReviewPhase({
  match,
  members,
  seat,
  word,
  clues,
  isHost,
  showing,
  onToggle,
  onShow,
}: ReviewPhaseProps) {
  const guesser = nameOf(members, match.guesserId);
  const canShow = seat === 'CLUE_GIVER' || isHost;
  const reviewed = (clues ?? []).filter((clue) => match.committedPlayerIds.includes(clue.authorId));
  const surviving = match.committedPlayerIds.length - match.cancelledAuthorIds.length;

  return (
    <section aria-labelledby="review-title" className="flex flex-col gap-5">
      {seat === 'CLUE_GIVER' ? (
        <>
          <WordCard word={word} />
          <div className="flex flex-col gap-1 text-center">
            <h2 id="review-title" className="text-2xl font-bold">
              Revisen las pistas
            </h2>
            <p className="text-base text-balance text-cream/80">
              Las repetidas ya están tachadas. Toca una pista para tacharla o recuperarla.
            </p>
          </div>
          {clues === undefined ? (
            <p role="status" className="text-center text-lg text-cream/70">
              Cargando las pistas…
            </p>
          ) : (
            <Stagger>
              <ul aria-label="Pistas" className="grid grid-cols-2 gap-3 px-1 pt-2">
                {reviewed.map((clue, index) => {
                  const cancelled = match.cancelledAuthorIds.includes(clue.authorId);
                  const author = nameOf(members, clue.authorId);
                  return (
                    <StaggerItem as="li" key={clue.authorId}>
                      <button
                        type="button"
                        aria-pressed={cancelled}
                        aria-label={`${clue.clue}, de ${author}${cancelled ? ', tachada' : ''}`}
                        onClick={() => {
                          onToggle(clue.authorId, !cancelled);
                        }}
                        className="flex w-full rounded-2xl focus-visible:ring-2 focus-visible:ring-moon focus-visible:ring-offset-4 focus-visible:ring-offset-night focus-visible:outline-none motion-safe:transition-transform motion-safe:active:scale-95"
                      >
                        <ClueCard
                          clue={clue.clue}
                          index={index}
                          author={author}
                          cancelled={cancelled}
                          stamp={cancelled ? 'Tachada' : 'Queda'}
                        />
                      </button>
                    </StaggerItem>
                  );
                })}
                {reviewed.length === 0 && (
                  <li className="col-span-2 text-center text-lg text-cream/70">
                    Nadie escribió una pista
                  </li>
                )}
              </ul>
            </Stagger>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 id="review-title" className="text-2xl font-bold text-balance">
            {seat === 'GUESSER' ? 'Te toca adivinar' : `Adivina ${guesser}`}
          </h2>
          <Waiting>
            {seat === 'GUESSER' ? 'Tus compañeros' : 'Los demás'} están revisando las pistas…
          </Waiting>
        </div>
      )}

      <p
        role="status"
        className="self-center rounded-full bg-cream/8 px-4 py-1 text-lg font-semibold text-cream/85"
      >
        {surviving === 1 ? 'Queda 1 pista' : `Quedan ${String(surviving)} pistas`}
      </p>

      {canShow && (
        <Button busy={showing} onClick={onShow}>
          Mostrar pistas
        </Button>
      )}
    </section>
  );
}
