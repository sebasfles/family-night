import { JUST_ONE_GUESS_MAX, type JustOnePublic, type RoomMember } from '@family-night/shared';
import { useId } from 'react';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import type { Seat } from './model';
import { WordCard } from './WordCard';

interface GuessPhaseProps {
  match: JustOnePublic;
  members: RoomMember[];
  seat: Seat;
  word: string | undefined;
  draft: string;
  sent: string | null | undefined;
  onDraft: (draft: string) => void;
  onGuess: (guess: string | null) => void;
}

export function GuessPhase({
  match,
  members,
  seat,
  word,
  draft,
  sent,
  onDraft,
  onGuess,
}: GuessPhaseProps) {
  const guesser = nameOf(members, match.guesserId);
  const clues = match.clues ?? [];

  return (
    <section aria-labelledby="guess-title" className="flex flex-col gap-5">
      {seat === 'CLUE_GIVER' && <WordCard word={word} />}

      <div className="flex flex-col gap-3 rounded-3xl bg-night-soft p-5 ring-1 ring-cream/10">
        <h2 id="guess-title" className="text-center text-lg font-semibold text-cream/80">
          {seat === 'GUESSER' ? 'Tus pistas' : `Pistas para ${guesser}`}
        </h2>
        {clues.length === 0 ? (
          <p className="text-center text-xl font-semibold">No quedó ninguna pista</p>
        ) : (
          <ul aria-label="Pistas" className="flex flex-wrap justify-center gap-2">
            {clues.map((clue) => (
              <li
                key={clue.authorId}
                className="rounded-2xl bg-cream px-4 py-2 text-2xl font-bold break-words text-night"
              >
                {clue.clue}
              </li>
            ))}
          </ul>
        )}
      </div>

      {seat === 'GUESSER' && sent !== undefined && (
        <p role="status" className="text-center text-xl font-semibold text-balance break-words">
          {sent === null
            ? 'Pasaste. Viendo el resultado…'
            : `Dijiste «${sent}». Viendo el resultado…`}
        </p>
      )}
      {seat === 'GUESSER' && sent === undefined && (
        <GuessForm guess={draft} onDraft={onDraft} onGuess={onGuess} />
      )}
      {seat !== 'GUESSER' && (
        <p role="status" className="text-center text-xl font-semibold text-balance">
          {guesser} está adivinando…
        </p>
      )}
    </section>
  );
}

function GuessForm({
  guess,
  onDraft,
  onGuess,
}: {
  guess: string;
  onDraft: (draft: string) => void;
  onGuess: (guess: string | null) => void;
}) {
  const inputId = useId();
  const trimmed = guess.trim();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onGuess(trimmed);
      }}
    >
      <label htmlFor={inputId} className="text-lg font-semibold">
        ¿Cuál es la palabra?
      </label>
      <input
        id={inputId}
        value={guess}
        maxLength={JUST_ONE_GUESS_MAX}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        onChange={(event) => {
          onDraft(event.target.value);
        }}
        className="min-h-14 rounded-2xl bg-cream px-4 text-xl text-night placeholder:text-night/50 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:opacity-70"
        placeholder="Tu respuesta"
      />
      <Button type="submit" disabled={!trimmed}>
        Adivinar
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          onGuess(null);
        }}
      >
        Pasar
      </Button>
    </form>
  );
}
