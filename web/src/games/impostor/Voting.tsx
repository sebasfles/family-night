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
  selection: string | null;
  selectionGone: boolean;
  isHost: boolean;
  closing: boolean;
  onSelect: (targetId: string) => void;
  onConfirm: (targetId: string) => void;
  onClose: () => void;
}

export function Voting({
  match,
  members,
  selfId,
  canVote,
  selection,
  selectionGone,
  isHost,
  closing,
  onSelect,
  onConfirm,
  onClose,
}: VotingProps) {
  const [confirm, setConfirm] = useState(false);
  const voted = match.votedPlayerIds.length;
  const total = match.order.length;
  const missing = total - voted;
  const confirmed = match.votedPlayerIds.includes(selfId);

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
          const selected = canVote && selection === playerId;
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
                  disabled={confirmed}
                  onClick={() => {
                    if (!selected) onSelect(playerId);
                  }}
                  className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-lg font-semibold focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:cursor-default ${
                    selected
                      ? 'bg-moon text-night'
                      : `bg-night-soft ring-1 ring-cream/15 ${confirmed ? 'text-cream/60' : ''}`
                  }`}
                >
                  <span className="min-w-0 break-words">
                    {name}
                    {selected && ' '}
                    {selected && (
                      <span className="ml-1 text-base font-normal">
                        {confirmed ? 'tu voto' : 'tu elección'}
                      </span>
                    )}
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

      {canVote &&
        (confirmed ? (
          <p className="text-center text-lg font-semibold">
            {selection ? `Votaste por ${nameOf(members, selection)}. ` : ''}Esperando a los demás…
          </p>
        ) : (
          <>
            <Button
              disabled={selection === null}
              onClick={() => {
                if (selection) onConfirm(selection);
              }}
            >
              Confirmar voto
            </Button>
            <p className="text-center text-base text-cream/70">
              {selection
                ? 'Puedes cambiarlo hasta que confirmes.'
                : selectionGone
                  ? 'Quien elegiste ya no está en juego. Elige de nuevo.'
                  : 'Toca a quien quieras votar.'}
            </p>
          </>
        ))}

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
          title={`${missing === 1 ? 'Falta 1 por confirmar' : `Faltan ${String(missing)} por confirmar`}. Si ya eligieron, su elección cuenta. ¿Cerrar la votación?`}
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
