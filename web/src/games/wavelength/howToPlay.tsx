import { dialPoints, psychicPoints } from '@family-night/shared';
import { DEMO_FAMILY, DEMO_SELF, demoId } from '../../components/demoFamily';
import type { HowToPlayStep } from '../../components/HowToPlay';
import { Scoreboard } from '../../components/Scoreboard';
import { ClueBanner } from './ClueBanner';
import { Dial } from './Dial';

const LEFT = 'Frío';
const RIGHT = 'Caliente';
const TARGET = 74;
const CLUE = 'Sopa recién hecha';
const psychic = DEMO_FAMILY[1]?.name ?? '';

const guesses = [
  { index: 0, value: 73 },
  { index: 2, value: 82 },
  { index: 3, value: 50 },
  { index: 4, value: 63 },
].map((guess) => ({ ...guess, points: dialPoints(guess.value, TARGET) }));
const psychicGain = psychicPoints(guesses.map((guess) => guess.points));

export const wavelengthSteps: HowToPlayStep[] = [
  {
    title: 'Le toca al psíquico',
    text: 'En cada ronda uno es el psíquico, por turnos. Solo él ve dónde está el objetivo en la escala.',
    Scene: () => <Dial label="El objetivo" left={LEFT} right={RIGHT} target={TARGET} />,
  },
  {
    title: 'Da una pista',
    text: 'El psíquico escribe una pista, de hasta 40 letras, para que los demás lleguen al centro de la zona.',
    Scene: () => (
      <>
        <ClueBanner title={`La pista de ${psychic}`} clue={CLUE} />
        <Dial label={`Escala entre ${LEFT} y ${RIGHT}`} left={LEFT} right={RIGHT} />
      </>
    ),
  },
  {
    title: 'Mueve tu dial',
    text: 'Cada uno arrastra su dial, o usa − y +, y toca Confirmar. Nadie ve dónde lo pusieron los demás.',
    Scene: () => (
      <>
        <ClueBanner title={`La pista de ${psychic}`} clue={CLUE} />
        <Dial label="Tu respuesta" left={LEFT} right={RIGHT} value={guesses[0]?.value ?? null} />
      </>
    ),
  },
  {
    title: 'Se revela el objetivo',
    text: 'Las zonas se dan vuelta con el dial de cada uno. En el centro se ganan 4 puntos; más lejos, 3 o 2.',
    Scene: () => (
      <Dial
        label={`Objetivo en ${String(TARGET)}`}
        left={LEFT}
        right={RIGHT}
        target={TARGET}
        reveal
        markers={guesses.map(({ index, value }) => ({
          id: demoId(index),
          value,
          label: (DEMO_FAMILY[index]?.name ?? '').split(' ')[0] ?? '',
          highlight: demoId(index) === DEMO_SELF,
        }))}
      />
    ),
  },
  {
    title: 'Suman puntos',
    text: 'El psíquico gana el promedio de los puntos de los demás. Al final, el primero suma a la noche un punto por jugador, el segundo uno menos, y así; los empatados comparten el puesto. Con 2 jugadores la partida no suma.',
    Scene: () => (
      <Scoreboard
        title="Puntaje"
        rows={[
          { playerId: demoId(1), from: 2, to: 2 + psychicGain },
          ...guesses.map(({ index, points }) => ({
            playerId: demoId(index),
            from: index === 3 ? 4 : 1,
            to: (index === 3 ? 4 : 1) + points,
          })),
        ]}
        members={DEMO_FAMILY}
        selfId={DEMO_SELF}
        gains
      />
    ),
  },
];
