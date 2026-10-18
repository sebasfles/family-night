import { JUST_ONE_GUESS_MAX, type JustOnePublic, type RoomMember } from '@family-night/shared';
import { useId, useState } from 'react';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import type { Seat } from './model';
import { WordCard } from './WordCard';

interface GuessPhaseProps {
  match: JustOnePublic;
  members: RoomMember[];
  seat: Seat;
  word: string | undefined;
  guessing: boolean;
  onGuess: (guess: string | null) => Promise<unknown>;
}

export function GuessPhase({ match, members, seat, word, guessing, onGuess }: GuessPhaseProps) {
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

      {seat === 'GUESSER' ? (
        <GuessForm guessing={guessing} onGuess={onGuess} />
      ) : (
        <p role="status" className="text-center text-xl font-semibold text-balance">
          {guesser} está adivinando…
        </p>
      )}
    </section>
  );
}

function GuessForm({
  guessing,
  onGuess,
}: {
  guessing: boolean;
  onGuess: (guess: string | null) => Promise<unknown>;
}) {
  const inputId = useId();
  const [guess, setGuess] = useState('');
  const [sent, setSent] = useState<'GUESS' | 'PASS' | null>(null);
  const trimmed = guess.trim();
  const locked = guessing || sent !== null;
  const send = (kind: 'GUESS' | 'PASS') => {
    if (locked) return;
    setSent(kind);
    onGuess(kind === 'PASS' ? null : trimmed).catch(() => {
      setSent(null);
    });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) send('GUESS');
      }}
    >
      <label htmlFor={inputId} className="text-lg font-semibold">
        ¿Cuál es la palabra?
      </label>
      <input
        id={inputId}
        value={guess}
        maxLength={JUST_ONE_GUESS_MAX}
        disabled={locked}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        onChange={(event) => {
          setGuess(event.target.value);
        }}
        className="min-h-14 rounded-2xl bg-cream px-4 text-xl text-night placeholder:text-night/50 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:opacity-70"
        placeholder="Tu respuesta"
      />
      <Button type="submit" disabled={!trimmed || sent === 'PASS'} busy={sent === 'GUESS'}>
        Adivinar
      </Button>
      <Button
        variant="ghost"
        disabled={sent === 'GUESS'}
        busy={sent === 'PASS'}
        onClick={() => {
          send('PASS');
        }}
      >
        Pasar
      </Button>
    </form>
  );
}
