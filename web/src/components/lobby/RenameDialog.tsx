import {
  normalizePlayerName,
  PLAYER_NAME_MAX,
  playerNameKey,
  type RoomMember,
} from '@family-night/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { Pop } from '../../motion/motion';
import { Backdrop } from '../Backdrop';
import { Button } from '../Button';
import { field } from '../field';

interface RenameDialogProps {
  current: string;
  others: RoomMember[];
  onRename: (name: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ current, others, onRename, onCancel }: RenameDialogProps) {
  const titleId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(current);
  const name = normalizePlayerName(draft);
  const taken =
    name !== null && others.some((member) => playerNameKey(member.name) === playerNameKey(name));
  const problem =
    name === null
      ? 'Entre 2 y 20 caracteres visibles'
      : taken
        ? 'Alguien de la sala ya se llama así'
        : null;

  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    input.current?.select();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <Backdrop>
      <Pop className="w-full max-w-sm">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex flex-col gap-4 surface p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (name === null || taken) return;
            if (name === current) onCancel();
            else onRename(name);
          }}
        >
          <h2 id={titleId} className="text-center text-xl font-bold">
            Tu nombre
          </h2>
          <input
            ref={input}
            aria-labelledby={titleId}
            aria-describedby={hintId}
            aria-invalid={problem !== null}
            value={draft}
            maxLength={PLAYER_NAME_MAX + 10}
            autoComplete="nickname"
            enterKeyHint="done"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            className={field}
          />
          <p
            id={hintId}
            className={`text-base ${problem && draft.trim() !== '' ? 'text-ember' : 'text-cream/70'}`}
          >
            {problem ?? 'Así te verán en todas las salas.'}
          </p>
          <div className="flex flex-col gap-3">
            <Button type="submit" disabled={problem !== null}>
              Guardar
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </Pop>
    </Backdrop>
  );
}
