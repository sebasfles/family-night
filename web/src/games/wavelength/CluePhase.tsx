import { WAVELENGTH_CLUE_MAX, type RoomMember, type WavelengthPublic } from '@family-night/shared';
import { useId, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { field } from '../../components/field';
import { DialIcon } from '../../components/icons';
import { Notice } from '../../components/Notice';
import { Waiting } from '../../components/Waiting';
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
  draft: string;
  skipping: boolean;
  onDraft: (draft: string) => void;
  onClue: (clue: string) => void;
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
  draft,
  skipping,
  onDraft,
  onClue,
  onSkip,
}: CluePhaseProps) {
  const psychic = nameOf(members, match.psychicId);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const { left, right } = match.spectrum;

  return (
    <section aria-labelledby="clue-title" className="flex flex-col gap-5">
      {match.skipped && (
        <Notice>
          {nameOf(members, match.skipped.psychicId)} {skipReasons[match.skipped.reason]}, ahora le
          toca a {psychic}
        </Notice>
      )}

      {seat === 'PSYCHIC' ? (
        <>
          <div className="flex items-center gap-4 surface p-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-moon/14 text-moon">
              <DialIcon className="size-9" />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 id="clue-title" className="text-2xl font-bold">
                Eres el psíquico
              </h2>
              <p className="text-base text-cream/80">
                Da una pista para que lleguen al centro de la zona.
              </p>
            </div>
          </div>
          {target === undefined ? (
            <p role="status" className="text-center text-lg text-cream/70">
              Cargando el objetivo…
            </p>
          ) : (
            <Dial label="El objetivo" left={left} right={right} target={target} />
          )}
          <ClueForm clue={draft} onDraft={onDraft} onClue={onClue} />
        </>
      ) : (
        <>
          <h2 id="clue-title" className="sr-only">
            Esperando la pista
          </h2>
          <Dial label={`Escala entre ${left} y ${right}`} left={left} right={right} />
          <Waiting>{psychic} está pensando la pista…</Waiting>
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
  clue,
  onDraft,
  onClue,
}: {
  clue: string;
  onDraft: (draft: string) => void;
  onClue: (clue: string) => void;
}) {
  const inputId = useId();
  const trimmed = clue.trim();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onClue(trimmed);
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-xl font-bold">
          Tu pista
        </label>
        <span className="text-base text-cream/70 tabular-nums">
          {clue.length}/{WAVELENGTH_CLUE_MAX}
        </span>
      </div>
      <input
        id={inputId}
        value={clue}
        maxLength={WAVELENGTH_CLUE_MAX}
        autoComplete="off"
        enterKeyHint="send"
        onChange={(event) => {
          onDraft(event.target.value);
        }}
        className={field}
        placeholder="Por ejemplo: sopa de la abuela"
      />
      <Button type="submit" disabled={!trimmed}>
        Dar pista
      </Button>
    </form>
  );
}
