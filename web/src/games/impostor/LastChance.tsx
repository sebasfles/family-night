import type { ImpostorPublic, RoomMember } from '@family-night/shared';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { nameOf } from './model';

interface LastChanceProps {
  match: ImpostorPublic;
  members: RoomMember[];
  selfId: string;
  isHost: boolean;
  guesserOnline: boolean;
  busy: boolean;
  onGuess: (option: string) => void;
  onSkip: () => void;
}

export function LastChance({
  match,
  members,
  selfId,
  isHost,
  guesserOnline,
  busy,
  onGuess,
  onSkip,
}: LastChanceProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const guess = match.guess;
  if (!guess) return null;
  const name = nameOf(members, guess.guesserId);

  if (guess.guesserId === selfId) {
    return (
      <section aria-labelledby="guess-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 text-center">
          <h2 id="guess-title" className="text-2xl font-bold">
            ¡Te atraparon!
          </h2>
          <p className="text-lg text-cream/80">Última oportunidad: ¿cuál es la palabra?</p>
        </div>
        <ul className="flex flex-col gap-2">
          {guess.options.map((option) => (
            <li key={option}>
              <Button
                variant="secondary"
                className="w-full"
                busy={busy && picked === option}
                disabled={busy}
                onClick={() => {
                  setPicked(option);
                  onGuess(option);
                }}
              >
                {option}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-labelledby="guess-title" className="flex flex-col gap-4 text-center">
      <h2 id="guess-title" className="text-2xl font-bold">
        Última oportunidad
      </h2>
      <p role="status" className="text-lg text-balance text-cream/80">
        {name} está intentando adivinar la palabra…
      </p>
      {isHost && !guesserOnline && (
        <div className="flex flex-col gap-3">
          <p className="text-base text-cream/70">{name} no está conectado.</p>
          <Button variant="secondary" busy={busy} onClick={onSkip}>
            Saltar
          </Button>
        </div>
      )}
    </section>
  );
}
