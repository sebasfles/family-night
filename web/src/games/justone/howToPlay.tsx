import { autoCancelled } from '@family-night/shared';
import { demoId, DEMO_FAMILY } from '../../components/demoFamily';
import type { HowToPlayStep } from '../../components/HowToPlay';
import { nameOf } from '../../components/match';
import { FlipReveal } from '../../motion/Flip';
import { ClueCard } from './ClueCard';
import { RevealedWord, TeamScore } from './RevealPhase';
import { WordBack, WordCard } from './WordCard';

const WORD = 'Playa';
const written = [
  { authorId: demoId(0), clue: 'Arena' },
  { authorId: demoId(1), clue: 'Sol' },
  { authorId: demoId(2), clue: 'Verano' },
  { authorId: demoId(4), clue: 'soles' },
];
const repeated = autoCancelled(written, WORD);
const clues = written.map((clue) => ({ ...clue, cancelled: repeated.includes(clue.authorId) }));

function clueList({
  review = false,
  survivors = false,
}: {
  review?: boolean;
  survivors?: boolean;
}) {
  const shown = survivors ? clues.filter((clue) => !clue.cancelled) : clues;
  return (
    <ul className="grid grid-cols-2 gap-3 px-1 pt-2">
      {shown.map((clue, index) => {
        const cancelled = review && clue.cancelled;
        return (
          <li key={clue.authorId} className="flex">
            <ClueCard
              clue={clue.clue}
              index={index}
              author={survivors ? undefined : nameOf(DEMO_FAMILY, clue.authorId)}
              cancelled={cancelled}
              stamp={review ? (cancelled ? 'Tachada' : 'Queda') : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}

export const justOneSteps: HowToPlayStep[] = [
  {
    title: 'Uno adivina, los demás ayudan',
    text: 'En cada ronda uno es el adivinador, por turnos. Los demás ven la palabra secreta; el adivinador no.',
    Scene: () => <WordCard word={WORD} />,
  },
  {
    title: 'Una pista, una palabra',
    text: 'Cada uno escribe una sola palabra, sin espacios. Una vez dada, la pista no se cambia.',
    Scene: () => clueList({}),
  },
  {
    title: 'Las repetidas se tachan',
    text: 'Las pistas iguales se tachan solas, aunque cambien tildes o plurales. Quienes dan pistas pueden tachar otra o recuperarla antes de mostrarlas.',
    Scene: () => clueList({ review: true }),
  },
  {
    title: 'A adivinar',
    text: 'El adivinador ve solo las pistas que quedan, escribe su respuesta y toca Adivinar, o pasa.',
    Scene: () => clueList({ survivors: true }),
  },
  {
    title: 'Suma el equipo',
    text: 'La palabra se da vuelta. Acertar suma 1 al equipo, pasar no suma y fallar resta 1, sin bajar de 0.',
    Scene: () => (
      <>
        <FlipReveal back={<WordBack />}>
          <RevealedWord word={WORD} outcome="CORRECT" verdict="¡Mateo acertó!" />
        </FlipReveal>
        <TeamScore from={2} to={3} outcome="CORRECT" floored={false} />
      </>
    ),
  },
];
