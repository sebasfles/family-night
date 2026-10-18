import { WAVELENGTH_CLUE_MAX, type RoomMember, type WavelengthPublic } from '@family-night/shared';
import { useId, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { nameOf } from '../../components/match';
import { Dial } from './Dial';
import type { Seat } from './model';

interface CluePhaseProps {
  match: WavelengthPublic;
  members: RoomMember[];
  seat: Seat;
  target: number | undefined;
  isHost: boolean;
  psychicOnline: boolean;
  sending: boolean;
  skipping: boolean;
  onClue: (clue: string) => Promise<unknown>;
  onSkip: () => void;
}

const skipReasons = {
  LEFT: 'salió de la sala',
  KICKED: 'salió de la sala',
  SKIPPED: 'perdió su turno',
} as const;

export function CluePhase({
  match,
  members,
  seat,
  target,
  isHost,
  psychicOnline,
  sending,
  skipping,
  onClue,
  onSkip,
}: CluePhaseProps) {
  const psychic = nameOf(members, match.psychicId);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const { left, right } = match.spectrum;

  return (
    <section aria-labelledby="clue-title" className="flex flex-col gap-5">
      {match.skipped && (
        <p
          role="status"
          className="rounded-2xl bg-cream/10 px-4 py-3 text-center text-base text-cream/90"
        >
          {nameOf(members, match.skipped.psychicId)} {skipReasons[match.skipped.reason]}, ahora le
          toca a {psychic}
        </p>
      )}

      {seat === 'PSYCHIC' ? (
        <>
          <div className="flex flex-col gap-1 text-center">
            <h2 id="clue-title" className="text-2xl font-bold">
              Eres el psíquico
            </h2>
            <p className="text-base text-cream/80">
              Da una pista para que lleguen al centro de la zona.
            </p>
          </div>
          {target === undefined ? (
            <p role="status" className="text-center text-lg text-cream/70">
              Cargando el objetivo…
            </p>
          ) : (
            <Dial label="El objetivo" left={left} right={right} target={target} />
          )}
          <ClueForm sending={sending} onClue={onClue} />
        </>
      ) : (
        <>
          <h2 id="clue-title" className="sr-only">
            Esperando la pista
          </h2>
          <Dial label={`Escala entre ${left} y ${right}`} left={left} right={right} />
          <p role="status" className="text-center text-xl font-semibold text-balance">
            {psychic} está pensando la pista…
          </p>
          {isHost && !psychicOnline && (
            <Button
              variant="secondary"
              busy={skipping}
              onClick={() => {
                setConfirmSkip(true);
              }}
            >
              Saltar turno
            </Button>
          )}
        </>
      )}

      {confirmSkip && (
        <ConfirmDialog
          title={`${psychic} no está en línea. ¿Saltar su turno?`}
          confirmLabel="Sí, saltar"
          busy={skipping}
          onConfirm={() => {
            setConfirmSkip(false);
            onSkip();
          }}
          onCancel={() => {
            setConfirmSkip(false);
          }}
        />
      )}
    </section>
  );
}

function ClueForm({
  sending,
  onClue,
}: {
  sending: boolean;
  onClue: (clue: string) => Promise<unknown>;
}) {
  const inputId = useId();
  const [clue, setClue] = useState('');
  const [sent, setSent] = useState(false);
  const trimmed = clue.trim();
  const locked = sending || sent;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed || locked) return;
        setSent(true);
        onClue(trimmed).catch(() => {
          setSent(false);
        });
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-lg font-semibold">
          Tu pista
        </label>
        <span className="text-base text-cream/60 tabular-nums">
          {clue.length}/{WAVELENGTH_CLUE_MAX}
        </span>
      </div>
      <input
        id={inputId}
        value={clue}
        maxLength={WAVELENGTH_CLUE_MAX}
        disabled={locked}
        autoComplete="off"
        enterKeyHint="send"
        onChange={(event) => {
          setClue(event.target.value);
        }}
        className="min-h-14 rounded-2xl bg-cream px-4 text-xl text-night placeholder:text-night/50 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:opacity-70"
        placeholder="Por ejemplo: sopa de la abuela"
      />
      <Button type="submit" disabled={!trimmed} busy={locked}>
        Dar pista
      </Button>
    </form>
  );
}
