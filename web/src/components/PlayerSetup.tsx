import { normalizePlayerName, PLAYER_NAME_MAX, playerNameKey } from '@family-night/shared';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from './Button';
import { field } from './field';
import { CloseIcon } from './icons';

interface PlayerSetupProps {
  game: string;
  min: number;
  max: number;
  onStart: (names: string[]) => void;
  onBack: () => void;
}

interface Row {
  id: number;
  draft: string;
}

function problemsOf(rows: Row[]): (string | null)[] {
  const seen = new Set<string>();
  return rows.map(({ draft }) => {
    const name = normalizePlayerName(draft);
    if (name === null) return 'Entre 2 y 20 caracteres visibles';
    const key = playerNameKey(name);
    if (seen.has(key)) return 'Otro jugador ya se llama así';
    seen.add(key);
    return null;
  });
}

export function PlayerSetup({ game, min, max, onStart, onBack }: PlayerSetupProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: min }, (_, id) => ({ id, draft: '' })),
  );
  const nextId = useRef(min);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const [focusId, setFocusId] = useState<number | null>(null);
  const problems = problemsOf(rows);
  const ready = rows.length >= min && problems.every((problem) => problem === null);
  const full = rows.length >= max;

  useEffect(() => {
    if (focusId !== null) inputs.current.get(focusId)?.focus();
  }, [focusId]);

  const add = () => {
    const id = nextId.current++;
    setRows((current) => [...current, { id, draft: '' }]);
    setFocusId(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = rows[index + 1];
    if (next) setFocusId(next.id);
    else if (!full && event.currentTarget.value.trim() !== '') add();
  };

  return (
    <section aria-labelledby="setup-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-base font-bold text-moon">{game} en un solo dispositivo</p>
        <h1 id="setup-title" className="text-3xl font-bold">
          ¿Quiénes juegan?
        </h1>
        <p className="text-lg text-cream/80">
          Escriban los nombres en el orden en que están sentados.
        </p>
      </div>

      <ol aria-label="Jugadores" className="grid gap-3 md:grid-cols-2 md:gap-x-6">
        {rows.map((row, index) => {
          const problem = problems[index] ?? null;
          const shown = problem !== null && row.draft.trim() !== '';
          const label = `Jugador ${String(index + 1)}`;
          const hintId = `player-hint-${String(row.id)}`;
          return (
            <li key={row.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-night-raised font-display text-sm font-bold text-cream/75 tabular-nums"
                >
                  {index + 1}
                </span>
                <input
                  ref={(element) => {
                    if (element) inputs.current.set(row.id, element);
                    else inputs.current.delete(row.id);
                  }}
                  aria-label={label}
                  aria-invalid={shown}
                  aria-describedby={shown ? hintId : undefined}
                  value={row.draft}
                  maxLength={PLAYER_NAME_MAX + 10}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  onChange={(event) => {
                    const draft = event.target.value;
                    setRows((current) =>
                      current.map((entry) => (entry.id === row.id ? { ...entry, draft } : entry)),
                    );
                  }}
                  onKeyDown={(event) => {
                    onKeyDown(event, index);
                  }}
                  className={`${field} min-w-0 flex-1`}
                />
                {rows.length > min && (
                  <button
                    type="button"
                    aria-label={`Quitar ${label.toLowerCase()}`}
                    onClick={() => {
                      setRows((current) => current.filter((entry) => entry.id !== row.id));
                    }}
                    className="flex size-12 shrink-0 items-center justify-center rounded-full text-cream/70 transition-colors hover:bg-cream/8 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
                  >
                    <CloseIcon className="size-5" />
                  </button>
                )}
              </div>
              {shown && (
                <p id={hintId} className="pl-10 text-base text-ember">
                  {problem}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <Button variant="secondary" disabled={full} onClick={add} className="md:self-start">
        {full ? `Máximo ${String(max)} jugadores` : 'Agregar jugador'}
      </Button>

      <div className="flex flex-col gap-3 md:flex-row-reverse md:justify-start">
        <Button
          className="md:min-w-56"
          disabled={!ready}
          onClick={() => {
            onStart(rows.map(({ draft }) => normalizePlayerName(draft) ?? draft));
          }}
        >
          Empezar
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Volver
        </Button>
      </div>
    </section>
  );
}
