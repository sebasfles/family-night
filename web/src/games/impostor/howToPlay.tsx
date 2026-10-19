import { Button } from '../../components/Button';
import { DEMO_FAMILY, DEMO_SELF, demoId } from '../../components/demoFamily';
import type { HowToPlayStep } from '../../components/HowToPlay';
import { Scoreboard } from '../../components/Scoreboard';
import { FlipReveal } from '../../motion/Flip';
import { CardBack, CardFace } from './Card';
import { Tally, Verdict } from './Reveal';
import { TurnOrder } from './TurnOrder';
import { VoteList } from './Voting';

const everyone = DEMO_FAMILY.map((member) => member.playerId);
const impostor = demoId(2);

export const impostorSteps: HowToPlayStep[] = [
  {
    title: 'Cada uno recibe una carta',
    text: 'Toca tu carta para darla vuelta, sin que nadie más mire. Casi todos ven la misma palabra y su categoría.',
    Scene: () => (
      <FlipReveal back={<CardBack />}>
        <CardFace secret={{ role: 'CIVILIAN', word: 'Playa', category: 'Lugares' }} />
      </FlipReveal>
    ),
  },
  {
    title: 'Alguien es el impostor',
    text: 'El impostor no ve la palabra: recibe una pista, y la categoría solo si el host lo activó. Ningún impostor sabe quiénes son los otros.',
    Scene: () => (
      <FlipReveal back={<CardBack />}>
        <CardFace secret={{ role: 'IMPOSTOR', clue: 'Verano', category: 'Lugares' }} />
      </FlipReveal>
    ),
  },
  {
    title: 'Conversen por turnos',
    text: 'Hablen en persona siguiendo el orden de turno. Quien tiene la palabra demuestra que la conoce; el impostor disimula.',
    Scene: () => (
      <TurnOrder
        order={[demoId(3), ...everyone.filter((id) => id !== demoId(3))]}
        members={DEMO_FAMILY}
      />
    ),
  },
  {
    title: 'Voten al sospechoso',
    text: 'Toca a quien crees impostor y confirma tu voto; hasta confirmar puedes cambiarlo. Nadie ve por quién votaron los demás.',
    Scene: () => (
      <>
        <VoteList
          order={everyone}
          votedPlayerIds={[demoId(1), demoId(4)]}
          members={DEMO_FAMILY}
          selfId={DEMO_SELF}
          canVote
          selection={impostor}
          confirmed={false}
          onSelect={() => undefined}
        />
        <Button>Confirmar voto</Button>
      </>
    ),
  },
  {
    title: 'Se da vuelta su carta',
    text: 'El más votado queda eliminado y su carta muestra si era impostor. Si hay empate, decide la regla del host: sorteo o nadie sale.',
    Scene: () => (
      <>
        <FlipReveal
          back={
            <CardBack>
              <span className="mt-2 font-display text-5xl font-bold text-cream/80">?</span>
            </CardBack>
          }
        >
          <Verdict
            out={{ playerId: impostor, round: 1, wasImpostor: true, reason: 'VOTE' }}
            tie={false}
            members={DEMO_FAMILY}
          />
        </FlipReveal>
        <Tally
          participants={everyone}
          result={{
            round: 1,
            tie: false,
            eliminatedId: impostor,
            tally: [
              { playerId: impostor, votes: 3 },
              { playerId: demoId(3), votes: 1 },
              { playerId: demoId(1), votes: 1 },
            ],
          }}
          members={DEMO_FAMILY}
        />
      </>
    ),
  },
  {
    title: '¿Quién gana?',
    text: 'Los civiles ganan cuando no queda ningún impostor, y suman 1 punto cada uno. Los impostores ganan si llegan a ser tantos como los civiles que siguen en juego, y suman 2.',
    Scene: () => (
      <Scoreboard
        title="Puntaje de la noche"
        rows={everyone.map((playerId) => ({
          playerId,
          from: 0,
          to: playerId === impostor ? 0 : 1,
        }))}
        members={DEMO_FAMILY}
        selfId={DEMO_SELF}
        gains
      />
    ),
  },
];
