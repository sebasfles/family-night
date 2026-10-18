import type { ImpostorConfig, TieRule, WordCategory } from '@family-night/shared';
import type { ReactNode } from 'react';

interface ConfigPanelProps {
  config: ImpostorConfig;
  maxImpostors: number;
  playerCount: number;
  categories: WordCategory[] | undefined;
  editable: boolean;
  onChange: (config: ImpostorConfig) => void;
}

const control =
  'focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:cursor-default';

export function ConfigPanel({
  config,
  maxImpostors,
  playerCount,
  categories,
  editable,
  onChange,
}: ConfigPanelProps) {
  const locked = !editable;
  const set = (patch: Partial<ImpostorConfig>) => {
    onChange({ ...config, ...patch });
  };

  return (
    <section
      aria-labelledby="impostor-config-title"
      className="flex flex-col gap-5 rounded-3xl bg-night-soft p-5 ring-1 ring-cream/10"
    >
      <div className="flex flex-col gap-1">
        <h2 id="impostor-config-title" className="text-xl font-bold">
          Configuración
        </h2>
        {!editable && <p className="text-base text-cream/70">Solo el host puede cambiarla.</p>}
      </div>

      <Row
        label="Impostores"
        hint={`Hasta ${String(maxImpostors)} con ${String(playerCount)} ${playerCount === 1 ? 'jugador' : 'jugadores'}`}
      >
        <div className="flex items-center gap-2">
          <StepButton
            label="Un impostor menos"
            disabled={locked || config.impostorCount <= 1}
            onClick={() => {
              set({ impostorCount: config.impostorCount - 1 });
            }}
          >
            −
          </StepButton>
          <output
            aria-label="Impostores"
            className="w-8 text-center text-2xl font-bold tabular-nums"
          >
            {config.impostorCount}
          </output>
          <StepButton
            label="Un impostor más"
            disabled={locked || config.impostorCount >= maxImpostors}
            onClick={() => {
              set({ impostorCount: config.impostorCount + 1 });
            }}
          >
            +
          </StepButton>
        </div>
      </Row>

      <Switch
        label="Orden aleatorio"
        hint={config.randomOrder ? 'El turno se sortea' : 'El turno sigue el orden de llegada'}
        checked={config.randomOrder}
        disabled={locked}
        onChange={(randomOrder) => {
          set({ randomOrder });
        }}
      />

      <div className="flex flex-col gap-2">
        <p id="tie-rule-label" className="font-semibold">
          Si hay empate
        </p>
        <div role="radiogroup" aria-labelledby="tie-rule-label" className="grid grid-cols-2 gap-2">
          {(
            [
              ['RANDOM', 'Sorteo'],
              ['SKIP', 'Nadie sale'],
            ] as const satisfies readonly (readonly [TieRule, string])[]
          ).map(([rule, label]) => (
            <button
              key={rule}
              type="button"
              role="radio"
              aria-checked={config.tieRule === rule}
              disabled={locked}
              onClick={() => {
                set({ tieRule: rule });
              }}
              className={`min-h-12 rounded-2xl px-3 text-base font-semibold ${control} ${
                config.tieRule === rule
                  ? 'bg-moon text-night'
                  : 'bg-night text-cream/80 ring-1 ring-cream/15'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Switch
        label="Mostrar la categoría al impostor"
        checked={config.showCategoryToImpostor}
        disabled={locked}
        onChange={(showCategoryToImpostor) => {
          set({ showCategoryToImpostor });
        }}
      />

      <div className="flex flex-col gap-2">
        <p id="categories-label" className="font-semibold">
          Categorías
        </p>
        {categories ? (
          <ul aria-labelledby="categories-label" className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const on = config.categories.includes(category.id);
              const last = on && config.categories.length === 1;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={locked || last}
                    onClick={() => {
                      set({
                        categories: on
                          ? config.categories.filter((id) => id !== category.id)
                          : [...config.categories, category.id],
                      });
                    }}
                    className={`min-h-12 rounded-full px-4 text-base font-semibold ${control} ${
                      on ? 'bg-moon text-night' : 'bg-night text-cream/70 ring-1 ring-cream/15'
                    }`}
                  >
                    {category.name}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-base text-cream/60">Cargando categorías…</p>
        )}
      </div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <p className="font-semibold">{label}</p>
        {hint && <p className="text-sm text-cream/60">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-12 items-center justify-center rounded-full bg-night text-2xl font-bold ring-1 ring-cream/15 disabled:opacity-40 ${control}`}
    >
      {children}
    </button>
  );
}

function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      className={`flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl text-left ${control}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-cream/60">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-moon' : 'bg-cream/20'}`}
      >
        <span
          className={`absolute top-1 size-6 rounded-full bg-night transition-all ${checked ? 'left-7' : 'left-1'}`}
        />
      </span>
    </button>
  );
}
