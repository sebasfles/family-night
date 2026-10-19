import {
  manadaGoalReached,
  manadaPlayers,
  type ManadaGroup,
  type ManadaPublic,
  type RoomMember,
} from '@family-night/shared';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import { Scoreboard } from '../../components/Scoreboard';
import { CowCard } from './CowCard';
import { GroupCard } from './GroupCard';
import { outcomeOf, verdictOf } from './model';
import { QuestionCard } from './QuestionCard';

interface RevealPhaseProps {
  match: ManadaPublic;
  members: RoomMember[];
  selfId: string;
  isHost: boolean;
  advancing: boolean;
  onMerge: (groupIds: [string, string]) => void;
  onSplit: (groupId: string) => void;
  onNext: () => void;
}

export function RevealPhase({
  match,
  members,
  selfId,
  isHost,
  advancing,
  onMerge,
  onSplit,
  onNext,
}: RevealPhaseProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const result = match.lastResult;
  if (!result) return null;
  const { groups } = result;
  const players = manadaPlayers(match);
  const silent = players.filter((id) => !groups.some((group) => group.playerIds.includes(id)));
  const chosen = groups.find((group) => group.id === selected);
  const canMerge = isHost && groups.length >= 2;

  const select = (group: ManadaGroup) => {
    if (!chosen) setSelected(group.id);
    else if (chosen.id === group.id) setSelected(null);
    else {
      setSelected(null);
      onMerge([chosen.id, group.id]);
    }
  };

  return (
    <section aria-labelledby="reveal-title" className="flex flex-col gap-6">
      <QuestionCard question={match.question.text} />

      <div className="flex flex-col gap-3">
        <h2 id="reveal-title" className="text-2xl font-bold text-balance">
          {outcomeOf(groups)}
        </h2>
        {canMerge && (
          <p role="status" className="text-base text-cream/80">
            {chosen
              ? `Toca otro grupo para unirlo con «${chosen.labels.join(' / ')}», o tócalo de nuevo para soltarlo.`
              : 'Si dos grupos dicen lo mismo, toca uno y después el otro para unirlos.'}
          </p>
        )}
        <ul aria-label="Respuestas" className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupCard
                group={group}
                members={members}
                verdict={verdictOf(group, groups)}
                selected={group.id === selected}
                {...(canMerge
                  ? {
                      onSelect: () => {
                        select(group);
                      },
                      onSplit: () => {
                        onSplit(group.id);
                      },
                    }
                  : {})}
              />
            </li>
          ))}
        </ul>
        {silent.length > 0 && (
          <p className="text-base text-cream/70">
            Sin respuesta: {silent.map((id) => nameOf(members, id)).join(', ')}
          </p>
        )}
      </div>

      <CowCard
        holderId={match.cowHolderId}
        previousId={result.cowBefore}
        members={members}
        selfId={selfId}
      />

      <Scoreboard
        title="Puntos"
        rows={players.map((playerId) => ({
          playerId,
          from: result.totalsBefore[playerId] ?? 0,
          to: match.totals[playerId] ?? 0,
        }))}
        members={members}
        selfId={selfId}
        gains
      />

      {isHost ? (
        <Button busy={advancing} onClick={onNext}>
          {manadaGoalReached(match) ? 'Ver resultado' : 'Siguiente ronda'}
        </Button>
      ) : (
        <p role="status" className="text-center text-lg text-cream/80">
          Esperando al host…
        </p>
      )}
    </section>
  );
}
