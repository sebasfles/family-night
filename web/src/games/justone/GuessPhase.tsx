import { JUST_ONE_GUESS_MAX, type JustOnePublic, type RoomMember } from '@family-night/shared';
import { useId } from 'react';
import { Button } from '../../components/Button';
import { field } from '../../components/field';
import { nameOf } from '../../components/match';
import { Waiting } from '../../components/Waiting';
import { Stagger, StaggerItem } from '../../motion/motion';
import { ClueCard } from './ClueCard';
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

      <div className="flex flex-col gap-4 surface p-5">
        <h2 id="guess-title" className="text-center text-xl font-bold">
          {seat === 'GUESSER' ? 'Tus pistas' : `Pistas para ${guesser}`}
        </h2>
        {clues.length === 0 ? (
          <p className="text-center text-xl font-semibold text-cream/80">No quedó ninguna pista</p>
        ) : (
          <Stagger>
            <ul aria-label="Pistas" className="flex flex-wrap justify-center gap-3 pb-1">
              {clues.map((clue, index) => (
                <StaggerItem as="li" key={clue.authorId} className="flex w-[calc(50%-0.375rem)]">
                  <ClueCard clue={clue.clue} index={index} />
                </StaggerItem>
              ))}
            </ul>
          </Stagger>
        )}
      </div>

      {seat === 'GUESSER' && sent !== undefined && (
        <Waiting>
          {sent === null
            ? 'Pasaste. Viendo el resultado…'
            : `Dijiste «${sent}». Viendo el resultado…`}
        </Waiting>
      )}
      {seat === 'GUESSER' && sent === undefined && (
        <GuessForm guess={draft} onDraft={onDraft} onGuess={onGuess} />
      )}
      {seat !== 'GUESSER' && <Waiting>{guesser} está adivinando…</Waiting>}
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
      <label htmlFor={inputId} className="text-xl font-bold">
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
        className={field}
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
