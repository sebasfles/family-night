import { groupAnswers, MANADA_WIN_POINTS, type ManadaAnswer } from '@family-night/shared';
import { demoId, DEMO_FAMILY, DEMO_SELF } from '../../components/demoFamily';
import type { HowToPlayStep } from '../../components/HowToPlay';
import { AnswerCard } from './AnswerCard';
import { CowCard } from './CowCard';
import { GroupCard } from './GroupCard';
import { verdictOf } from './model';
import { QuestionCard } from './QuestionCard';
import { WinnerBanner } from './WinnerBanner';

const QUESTION = 'Una fruta amarilla';

function answers(texts: string[]): ManadaAnswer[] {
  return texts.map((answer, index) => ({ playerId: demoId(index), answer }));
}

const herd = groupAnswers(answers(['Plátano', 'plátanos', 'Piña', 'el plátano', 'Mango']), []);
const loner = groupAnswers(answers(['Plátano', 'plátanos', 'Plátano', 'el plátano', 'Mango']), []);

function groupList(groups: typeof herd, scored: boolean) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <li key={group.id}>
          <GroupCard
            group={group}
            members={DEMO_FAMILY}
            verdict={scored ? verdictOf(group, groups) : null}
          />
        </li>
      ))}
    </ul>
  );
}

export const manadaSteps: HowToPlayStep[] = [
  {
    title: 'Una pregunta para todos',
    text: 'En cada ronda aparece la misma pregunta en todos los celulares. No hay respuesta correcta: lo que vale es pensar como tu familia.',
    Scene: () => <QuestionCard question={QUESTION} />,
  },
  {
    title: 'Responde en secreto',
    text: 'Escribe de 1 a 3 palabras y confirma. Nadie ve tu respuesta hasta que todos respondan, y una vez confirmada no se cambia.',
    Scene: () => <AnswerCard answer="Plátano" />,
  },
  {
    title: 'Se juntan las iguales',
    text: 'Las respuestas iguales forman una manada, aunque cambien mayúsculas, tildes, plurales o un artículo. Si dos grupos dicen lo mismo con otras palabras, el host los une.',
    Scene: () => groupList(herd, false),
  },
  {
    title: 'Suma la manada más grande',
    text: 'Cada uno de la manada más grande suma 1 punto. Si dos manadas empatan en tamaño, nadie suma esa ronda.',
    Scene: () => groupList(herd, true),
  },
  {
    title: 'Cuidado con la vaca rosa',
    text: 'Si eres el único con una respuesta distinta, te llevas la vaca rosa. Si quedan dos o más solos, la vaca no se mueve. Con la vaca no puedes ganar.',
    Scene: () => (
      <>
        <CowCard
          holderId={demoId(4)}
          previousId={demoId(2)}
          members={DEMO_FAMILY}
          selfId={DEMO_SELF}
        />
        {groupList(loner, true)}
      </>
    ),
  },
  {
    title: 'Gana la manada',
    text: `Gana quien llegue a ${String(MANADA_WIN_POINTS)} puntos sin la vaca, o quien sume más al final de las rondas. A la noche suma por puesto: el primero un punto por jugador, el segundo uno menos, y así.`,
    Scene: () => <WinnerBanner winners={['Abuela Rosa']} points={MANADA_WIN_POINTS} />,
  },
];
