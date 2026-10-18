import { DIAL_MAX, guessersOf, type RoomMember, type WavelengthPublic } from '@family-night/shared';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SoundIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
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
      <div className="flex flex-col items-center gap-1 rounded-3xl bg-cream p-5 text-center text-night">
        <h2 id="guess-title" className="text-base font-semibold text-night/60">
          {seat === 'PSYCHIC' ? 'Tu pista' : `La pista de ${psychic}`}
        </h2>
        <p className="text-3xl font-bold text-balance break-words">{match.clue}</p>
      </div>

      {seat === 'GUESSER' ? (
        <div className="flex flex-col gap-2">
          {!committed && (
            <button
              type="button"
              aria-pressed={sound}
              aria-label="Sonido del dial"
              onClick={toggleSound}
              className="flex size-12 items-center justify-center self-end rounded-full text-cream/80 hover:bg-cream/10 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
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

      <p role="status" className="text-center text-lg text-cream/80">
        Adivinaron {done} de {total}
      </p>

      {seat === 'GUESSER' &&
        (committed ? (
          <p className="text-center text-xl font-semibold">Listo. Esperando a los demás…</p>
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
