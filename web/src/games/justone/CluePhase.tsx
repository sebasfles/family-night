import {
  clueGiversOf,
  JUST_ONE_CLUE_MAX,
  type JustOnePublic,
  type RoomMember,
} from '@family-night/shared';
import { useId, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { nameOf } from '../../components/match';
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
  sending: boolean;
  closing: boolean;
  onClue: (clue: string) => Promise<unknown>;
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
  sending,
  closing,
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
        <p
          role="status"
          className="rounded-2xl bg-cream/10 px-4 py-3 text-center text-base text-cream/90"
        >
          {nameOf(members, match.skipped.guesserId)} {skipReasons[match.skipped.reason]}, ahora le
          toca a {guesser}
        </p>
      )}

      {seat === 'CLUE_GIVER' ? (
        <>
          <h2 id="clue-title" className="sr-only">
            Escribe tu pista
          </h2>
          <WordCard word={word} />
          {committed ? (
            <div className="flex flex-col items-center gap-1 text-center">
              {myClue !== null && (
                <>
                  <p className="text-lg text-cream/80">Tu pista</p>
                  <p className="text-2xl font-bold break-words">{myClue}</p>
                </>
              )}
              <p className="text-lg text-cream/80">Listo. Esperando a los demás…</p>
            </div>
          ) : (
            <ClueForm guesser={guesser} sending={sending} onClue={onClue} />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 id="clue-title" className="text-2xl font-bold text-balance">
            {seat === 'GUESSER' ? 'Te toca adivinar' : `Adivina ${guesser}`}
          </h2>
          <p className="text-xl font-semibold text-balance">Están escribiendo pistas…</p>
        </div>
      )}

      <p role="status" className="text-center text-lg text-cream/80">
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
  sending,
  onClue,
}: {
  guesser: string;
  sending: boolean;
  onClue: (clue: string) => Promise<unknown>;
}) {
  const inputId = useId();
  const hintId = useId();
  const [clue, setClue] = useState('');
  const [sent, setSent] = useState(false);
  const locked = sending || sent;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!clue || locked) return;
        setSent(true);
        onClue(clue).catch(() => {
          setSent(false);
        });
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-lg font-semibold">
          Tu pista
        </label>
        <span className="text-base text-cream/60 tabular-nums">
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
        disabled={locked}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        aria-describedby={hintId}
        onChange={(event) => {
          setClue(event.target.value.replace(/\s/gu, ''));
        }}
        className="min-h-14 rounded-2xl bg-cream px-4 text-xl text-night placeholder:text-night/50 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:opacity-70"
        placeholder="Una palabra"
      />
      <Button type="submit" disabled={!clue} busy={locked}>
        Dar pista
      </Button>
    </form>
  );
}
