import {
  normalizePlayerName,
  PLAYER_NAME_MAX,
  playerNameKey,
  type RoomMember,
} from '@family-night/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../Button';

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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-night-soft p-6 ring-1 ring-cream/10"
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
          className="min-h-14 rounded-2xl bg-cream px-4 text-xl text-night focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
        />
        <p
          id={hintId}
          className={`text-base ${problem && draft.trim() !== '' ? 'text-orange-300' : 'text-cream/70'}`}
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
    </div>
  );
}
