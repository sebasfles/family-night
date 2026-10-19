import type { ImpostorPublic, RoomMember } from '@family-night/shared';
import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CheckIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
import { Waiting } from '../../components/Waiting';

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="voting-title" className="text-2xl font-bold">
          {canVote ? '¿Quién es el impostor?' : 'Votación'}
        </h2>
        <p
          role="status"
          className="rounded-full bg-cream/8 px-3 py-1 text-base font-semibold text-cream/85 tabular-nums"
        >
          Votaron {voted} de {total}
        </p>
      </div>
      <span aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full bg-cream/10">
        <span
          className="rounded-full bg-sage transition-[width] duration-500 ease-soft motion-reduce:transition-none"
          style={{ width: `${String(total ? (voted / total) * 100 : 0)}%` }}
        />
      </span>
      <ul className="flex flex-col gap-1.5 surface p-2">
        {match.order.map((playerId) => {
          const name = nameOf(members, playerId);
          const hasVoted = match.votedPlayerIds.includes(playerId);
          const selected = canVote && selection === playerId;
          const check = hasVoted && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage/16 text-sage">
              <CheckIcon className="size-5" />
              <span className="sr-only">ya votó</span>
            </span>
          );
          const avatar = <Avatar playerId={playerId} name={name} className="size-10 text-sm" />;
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
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-lg font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:cursor-default ${
                    selected
                      ? 'bg-moon/14 ring-2 ring-moon'
                      : `hover:bg-cream/6 ${confirmed ? 'text-cream/55' : ''}`
                  }`}
                >
                  {avatar}
                  <span className="min-w-0 flex-1 break-words">
                    {name}
                    {selected && ' '}
                    {selected && (
                      <span
                        className={`ml-1 inline-block rounded-full px-2.5 py-0.5 align-middle text-sm font-bold ${
                          confirmed ? 'bg-moon text-night' : 'bg-moon/20 text-moon'
                        }`}
                      >
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
              className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 text-lg"
            >
              {avatar}
              <span className="min-w-0 flex-1 break-words">
                {name}
                {playerId === selfId && <span className="ml-1.5 text-cream/60">(tú)</span>}
              </span>
              {check}
            </li>
          );
        })}
      </ul>

      {canVote &&
        (confirmed ? (
          <Waiting>
            {selection ? `Votaste por ${nameOf(members, selection)}. ` : ''}Esperando a los demás…
          </Waiting>
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
