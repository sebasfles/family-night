import { DIAL_MAX, guessersOf, type RoomMember, type WavelengthPublic } from '@family-night/shared';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SoundIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
import { Waiting } from '../../components/Waiting';
import { Dial } from './Dial';
import type { Seat } from './model';
import { useDialSound } from './tick';

interface GuessPhaseProps {
  match: WavelengthPublic;
  members: RoomMember[];
  seat: Seat;
  selfId: string;
  target: number | undefined;
  myGuess: number | null;
  isHost: boolean;
  closing: boolean;
  onCommit: (value: number) => void;
  onClose: () => void;
}

export function GuessPhase({
  match,
  members,
  seat,
  selfId,
  target,
  myGuess,
  isHost,
  closing,
  onCommit,
  onClose,
}: GuessPhaseProps) {
  const [value, setValue] = useState(myGuess ?? DIAL_MAX / 2);
  const [confirmClose, setConfirmClose] = useState(false);
  const [sound, toggleSound] = useDialSound();
  const total = guessersOf(match).length;
  const done = match.committedPlayerIds.length;
  const missing = total - done;
  const committed = match.committedPlayerIds.includes(selfId);
  const { left, right } = match.spectrum;
  const psychic = nameOf(members, match.psychicId);

  return (
    <section aria-labelledby="guess-title" className="flex flex-col gap-5">
      <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-card px-6 pt-8 pb-6 text-center card-paper">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-2 bg-linear-to-r from-lagoon via-sand to-ember"
        />
        <h2
          id="guess-title"
          className="font-sans text-sm font-bold tracking-[0.18em] text-night/65 uppercase"
        >
          {seat === 'PSYCHIC' ? 'Tu pista' : `La pista de ${psychic}`}
        </h2>
        <p className="font-display text-4xl leading-tight font-bold text-balance break-words">
          <span aria-hidden="true" className="text-night/30">
            «
          </span>
          {match.clue}
          <span aria-hidden="true" className="text-night/30">
            »
          </span>
        </p>
      </div>

      {seat === 'GUESSER' ? (
        <div className="flex flex-col gap-2">
          {!committed && (
            <button
              type="button"
              aria-pressed={sound}
              aria-label="Sonido del dial"
              onClick={toggleSound}
              className="flex size-12 items-center justify-center self-end rounded-full bg-night-soft text-cream/80 ring-1 ring-cream/10 hover:bg-night-raised focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none aria-pressed:text-moon"
            >
              <SoundIcon muted={!sound} className="size-6" />
            </button>
          )}
          <Dial
            label="Tu respuesta"
            left={left}
            right={right}
            value={committed ? (myGuess ?? value) : value}
            disabled={committed}
            sound={sound}
            onChange={setValue}
          />
        </div>
      ) : (
        <Dial
          label={seat === 'PSYCHIC' ? 'El objetivo' : `Escala entre ${left} y ${right}`}
          left={left}
          right={right}
          target={seat === 'PSYCHIC' ? (target ?? null) : null}
        />
      )}

      <p
        role="status"
        className="self-center rounded-full bg-cream/8 px-4 py-1 text-lg font-semibold text-cream/85 tabular-nums"
      >
        Adivinaron {done} de {total}
      </p>

      {seat === 'GUESSER' &&
        (committed ? (
          <Waiting>Listo. Esperando a los demás…</Waiting>
        ) : (
          <Button
            onClick={() => {
              onCommit(value);
            }}
          >
            Confirmar
          </Button>
        ))}

      {isHost && (
        <Button
          variant="secondary"
          busy={closing}
          onClick={() => {
            if (missing > 0) setConfirmClose(true);
            else onClose();
          }}
        >
          Cerrar
        </Button>
      )}

      {confirmClose && (
        <ConfirmDialog
          title={`Faltan ${String(missing)} por responder y sumarán 0. ¿Cerrar igual?`}
          confirmLabel="Sí, cerrar"
          busy={closing}
          onConfirm={() => {
            setConfirmClose(false);
            onClose();
          }}
          onCancel={() => {
            setConfirmClose(false);
          }}
        />
      )}
    </section>
  );
}
