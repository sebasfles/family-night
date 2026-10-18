import type { ImpostorPublic, RoomMember } from '@family-night/shared';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CheckIcon } from '../../components/icons';
import { nameOf } from '../../components/match';

interface VotingProps {
  match: ImpostorPublic;
  members: RoomMember[];
  selfId: string;
  canVote: boolean;
  myVote: string | null;
  pendingTarget: string | null;
  isHost: boolean;
  closing: boolean;
  onVote: (targetId: string) => void;
  onClose: () => void;
}

export function Voting({
  match,
  members,
  selfId,
  canVote,
  myVote,
  pendingTarget,
  isHost,
  closing,
  onVote,
  onClose,
}: VotingProps) {
  const [confirm, setConfirm] = useState(false);
  const voted = match.votedPlayerIds.length;
  const total = match.order.length;
  const missing = total - voted;

  return (
    <section aria-labelledby="voting-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="voting-title" className="text-xl font-bold">
          {canVote ? '¿Quién es el impostor?' : 'Votación'}
        </h2>
        <p role="status" className="text-base text-cream/80">
          Votaron {voted} de {total}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {match.order.map((playerId) => {
          const name = nameOf(members, playerId);
          const hasVoted = match.votedPlayerIds.includes(playerId);
          const selected = canVote && myVote === playerId;
          const check = hasVoted && (
            <span className={`flex items-center ${selected ? 'text-night' : 'text-emerald-400'}`}>
              <CheckIcon className="size-6" />
              <span className="sr-only">ya votó</span>
            </span>
          );
          if (canVote && playerId !== selfId) {
            return (
              <li key={playerId}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-busy={pendingTarget === playerId || undefined}
                  disabled={pendingTarget !== null}
                  onClick={() => {
                    onVote(playerId);
                  }}
                  className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-lg font-semibold focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:cursor-wait ${
                    selected ? 'bg-moon text-night' : 'bg-night-soft ring-1 ring-cream/15'
                  }`}
                >
                  <span className="min-w-0 break-words">
                    {name}
                    {selected && <span className="ml-2 text-base font-normal">tu voto</span>}
                  </span>
                  {check}
                </button>
              </li>
            );
          }
          return (
            <li
              key={playerId}
              className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-night-soft/60 px-4 text-lg ring-1 ring-cream/10"
            >
              <span className="min-w-0 break-words">
                {name}
                {playerId === selfId && <span className="ml-2 text-cream/60">(tú)</span>}
              </span>
              {check}
            </li>
          );
        })}
      </ul>

      {isHost && (
        <Button
          variant="secondary"
          busy={closing}
          onClick={() => {
            if (missing > 0) setConfirm(true);
            else onClose();
          }}
        >
          Cerrar votación
        </Button>
      )}

      {confirm && (
        <ConfirmDialog
          title={`Faltan ${String(missing)} ${missing === 1 ? 'voto' : 'votos'}. ¿Cerrar la votación igual?`}
          confirmLabel="Sí, cerrar"
          busy={closing}
          onConfirm={() => {
            setConfirm(false);
            onClose();
          }}
          onCancel={() => {
            setConfirm(false);
          }}
        />
      )}
    </section>
  );
}
