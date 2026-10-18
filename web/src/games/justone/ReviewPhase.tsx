import type { JustOneClue, JustOnePublic, RoomMember } from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import type { Seat } from './model';
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
            <ul aria-label="Pistas" className="flex flex-col gap-2">
              {reviewed.map((clue) => {
                const cancelled = match.cancelledAuthorIds.includes(clue.authorId);
                const author = nameOf(members, clue.authorId);
                return (
                  <li key={clue.authorId}>
                    <button
                      type="button"
                      aria-pressed={cancelled}
                      aria-label={`${clue.clue}, de ${author}${cancelled ? ', tachada' : ''}`}
                      onClick={() => {
                        onToggle(clue.authorId, !cancelled);
                      }}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none ${
                        cancelled
                          ? 'bg-night-soft/60 text-cream/50 ring-1 ring-cream/10'
                          : 'bg-night-soft ring-1 ring-cream/15'
                      }`}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={`text-xl font-bold break-words ${cancelled ? 'line-through' : ''}`}
                        >
                          {clue.clue}
                        </span>
                        <span className="text-base text-cream/60">{author}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                          cancelled ? 'bg-cream/10 text-cream/70' : 'bg-moon text-night'
                        }`}
                      >
                        {cancelled ? 'Tachada' : 'Queda'}
                      </span>
                    </button>
                  </li>
                );
              })}
              {reviewed.length === 0 && (
                <li className="text-center text-lg text-cream/70">Nadie escribió una pista</li>
              )}
            </ul>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 id="review-title" className="text-2xl font-bold text-balance">
            {seat === 'GUESSER' ? 'Te toca adivinar' : `Adivina ${guesser}`}
          </h2>
          <p className="text-xl font-semibold text-balance">
            {seat === 'GUESSER' ? 'Tus compañeros' : 'Los demás'} están revisando las pistas…
          </p>
        </div>
      )}

      <p role="status" className="text-center text-lg text-cream/80">
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
