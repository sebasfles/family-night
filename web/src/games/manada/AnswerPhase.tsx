import {
  cleanAnswer,
  isManadaAnswer,
  manadaPlayers,
  MANADA_ANSWER_MAX,
  MANADA_ANSWER_MAX_WORDS,
  type ManadaPublic,
} from '@family-night/shared';
import { useId, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { field } from '../../components/field';
import { Waiting } from '../../components/Waiting';
import { AnswerCard } from './AnswerCard';
import type { Seat } from './model';
import { QuestionCard } from './QuestionCard';

interface AnswerPhaseProps {
  match: ManadaPublic;
  seat: Seat;
  answered: boolean;
  myAnswer: string | null;
  isHost: boolean;
  draft: string;
  closing: boolean;
  onDraft: (draft: string) => void;
  onAnswer: (answer: string) => void;
  onClose: () => void;
}

export function AnswerPhase({
  match,
  seat,
  answered,
  myAnswer,
  isHost,
  draft,
  closing,
  onDraft,
  onAnswer,
  onClose,
}: AnswerPhaseProps) {
  const [confirmClose, setConfirmClose] = useState(false);
  const total = manadaPlayers(match).length;
  const done = match.answeredPlayerIds.length;
  const missing = total - done;

  return (
    <section aria-labelledby="question-title" className="flex flex-col gap-5">
      <QuestionCard question={match.question.text} titleId="question-title" />

      {seat === 'PLAYER' && !answered && (
        <AnswerForm answer={draft} onDraft={onDraft} onAnswer={onAnswer} />
      )}
      {seat === 'PLAYER' && answered && (
        <div className="flex flex-col items-center gap-4">
          {myAnswer !== null && <AnswerCard answer={myAnswer} />}
          <Waiting>Listo. Esperando a los demás…</Waiting>
        </div>
      )}
      {seat === 'SPECTATOR' && <Waiting>Están respondiendo…</Waiting>}

      <p
        role="status"
        className="self-center rounded-full bg-cream/8 px-4 py-1 text-lg font-semibold text-cream/85 tabular-nums"
      >
        Respondieron {done} de {total}
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
          Cerrar respuestas
        </Button>
      )}

      {confirmClose && (
        <ConfirmDialog
          title={`${missing === 1 ? 'Falta 1 respuesta' : `Faltan ${String(missing)} respuestas`} y no contarán. ¿Cerrar igual?`}
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

interface AnswerFormProps {
  answer: string;
  onDraft: (draft: string) => void;
  onAnswer: (answer: string) => void;
}

export function AnswerForm({ answer, onDraft, onAnswer }: AnswerFormProps) {
  const inputId = useId();
  const hintId = useId();
  const tooLong = cleanAnswer(answer).split(' ').length > MANADA_ANSWER_MAX_WORDS;
  const valid = isManadaAnswer(answer);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onAnswer(cleanAnswer(answer));
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-xl font-bold">
          Tu respuesta
        </label>
        <span className="text-base text-cream/70 tabular-nums">
          {answer.length}/{MANADA_ANSWER_MAX}
        </span>
      </div>
      <p id={hintId} className={`text-base ${tooLong ? 'font-bold text-ember' : 'text-cream/80'}`}>
        {tooLong
          ? `Máximo ${String(MANADA_ANSWER_MAX_WORDS)} palabras`
          : 'De 1 a 3 palabras. Suma si respondes lo mismo que la mayoría. Una vez confirmada no se cambia.'}
      </p>
      <input
        id={inputId}
        value={answer}
        maxLength={MANADA_ANSWER_MAX}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="send"
        aria-describedby={hintId}
        aria-invalid={tooLong || undefined}
        onChange={(event) => {
          onDraft(event.target.value.replace(/^\s+/u, '').replace(/\s{2,}/gu, ' '));
        }}
        className={field}
        placeholder="Lo que diría tu familia"
      />
      <Button type="submit" disabled={!valid}>
        Confirmar respuesta
      </Button>
    </form>
  );
}
