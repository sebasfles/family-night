import { nextTurn, type RoomMember, type WavelengthPublic } from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import { RoundResult } from './RoundResult';

interface RevealPhaseProps {
  match: WavelengthPublic;
  members: RoomMember[];
  selfId: string;
  isHost: boolean;
  busy: boolean;
  onNext: () => void;
}

export function RevealPhase({ match, members, selfId, isHost, busy, onNext }: RevealPhaseProps) {
  const result = match.lastResult;
  if (!result) return null;
  const last = nextTurn(match) === null;

  return (
    <section aria-labelledby="reveal-title" className="flex flex-col gap-6">
      <RoundResult
        titleId="reveal-title"
        match={match}
        players={members}
        selfId={selfId}
        subtitle={`Pista de ${nameOf(members, result.psychicId)}: «${match.clue ?? ''}»`}
      />

      {isHost ? (
        <Button busy={busy} onClick={onNext}>
          {last ? 'Ver resultado' : 'Siguiente ronda'}
        </Button>
      ) : (
        <p role="status" className="text-center text-lg text-cream/80">
          Esperando al host…
        </p>
      )}
    </section>
  );
}
