import {
  clueGiversOf,
  JUST_ONE_CLUE_MAX,
  type JustOnePublic,
  type RoomMember,
} from '@family-night/shared';
import { useId, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { field } from '../../components/field';
import { CluesIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
import { Notice } from '../../components/Notice';
import { Waiting } from '../../components/Waiting';
import { ClueCard } from './ClueCard';
import type { Seat } from './model';
import { WordCard } from './WordCard';

interface CluePhaseProps {
  match: JustOnePublic;
  members: RoomMember[];
  seat: Seat;
  word: string | undefined;
  committed: boolean;
  myClue: string | null;
  isHost: boolean;
  draft: string;
  closing: boolean;
  onDraft: (draft: string) => void;
  onClue: (clue: string) => void;
  onClose: () => void;
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
  word,
  committed,
  myClue,
  isHost,
  draft,
  closing,
  onDraft,
  onClue,
  onClose,
}: CluePhaseProps) {
  const guesser = nameOf(members, match.guesserId);
  const [confirmClose, setConfirmClose] = useState(false);
  const total = clueGiversOf(match).length;
  const done = match.committedPlayerIds.length;
  const missing = total - done;

  return (
    <section aria-labelledby="clue-title" className="flex flex-col gap-5">
      {match.skipped && (
        <Notice>
          {nameOf(members, match.skipped.guesserId)} {skipReasons[match.skipped.reason]}, ahora le
          toca a {guesser}
        </Notice>
      )}

      {seat === 'CLUE_GIVER' ? (
        <>
          <h2 id="clue-title" className="sr-only">
            Escribe tu pista
          </h2>
          <WordCard word={word} />
          {committed ? (
            <div className="flex flex-col items-center gap-4 text-center">
              {myClue !== null && (
                <div className="flex w-48 max-w-full flex-col gap-2">
                  <p className="font-sans text-sm font-bold tracking-[0.18em] text-cream/70 uppercase">
                    Tu pista
                  </p>
                  <ClueCard clue={myClue} index={1} />
                </div>
              )}
              <Waiting>Listo. Esperando a los demás…</Waiting>
            </div>
          ) : (
            <ClueForm guesser={guesser} clue={draft} onDraft={onDraft} onClue={onClue} />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-orchid/14 text-orchid">
            <CluesIcon className="size-10" />
          </span>
          <h2 id="clue-title" className="text-3xl font-bold text-balance">
            {seat === 'GUESSER' ? 'Te toca adivinar' : `Adivina ${guesser}`}
          </h2>
          <Waiting>Están escribiendo pistas…</Waiting>
        </div>
      )}

      <p
        role="status"
        className="self-center rounded-full bg-cream/8 px-4 py-1 text-lg font-semibold text-cream/85 tabular-nums"
      >
        Pistas listas: {done} de {total}
      </p>

      {isHost && (
        <Button
          variant="secondary"
          busy={closing}
          onClick={() => {
            if (missing > 0) setConfirmClose(true);
            else onClose();
          }}
        >
          Cerrar pistas
        </Button>
      )}

      {confirmClose && (
        <ConfirmDialog
          title={`${missing === 1 ? 'Falta 1 pista' : `Faltan ${String(missing)} pistas`} y no contarán. ¿Cerrar igual?`}
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

function ClueForm({
  guesser,
  clue,
  onDraft,
  onClue,
}: {
  guesser: string;
  clue: string;
  onDraft: (draft: string) => void;
  onClue: (clue: string) => void;
}) {
  const inputId = useId();
  const hintId = useId();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (clue) onClue(clue);
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-xl font-bold">
          Tu pista
        </label>
        <span className="text-base text-cream/70 tabular-nums">
          {clue.length}/{JUST_ONE_CLUE_MAX}
        </span>
      </div>
      <p id={hintId} className="text-base text-cream/80">
        Una sola palabra para que {guesser} adivine. Si alguien escribe la misma, se tachan las dos.
      </p>
      <input
        id={inputId}
        value={clue}
        maxLength={JUST_ONE_CLUE_MAX}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        aria-describedby={hintId}
        onChange={(event) => {
          onDraft(event.target.value.replace(/\s/gu, ''));
        }}
        className={field}
        placeholder="Una palabra"
      />
      <Button type="submit" disabled={!clue}>
        Dar pista
      </Button>
    </form>
  );
}
