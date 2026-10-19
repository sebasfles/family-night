import type { ImpostorConfig, TieRule, WordCategory } from '@family-night/shared';
import { useId, type ReactNode } from 'react';
import { ChevronDownIcon } from '../../components/icons';
import {
  chosen,
  ConfigSection,
  control,
  Segmented,
  unchosen,
} from '../../components/lobby/ConfigSection';

interface ConfigPanelProps {
  config: ImpostorConfig;
  maxImpostors: number;
  playerCount: number;
  categories: WordCategory[] | undefined;
  editable: boolean;
  categoriesOpen: boolean;
  onToggleCategories: () => void;
  onChange: (config: ImpostorConfig) => void;
}

const TIE_RULES = [
  ['RANDOM', 'Sorteo'],
  ['SKIP', 'Nadie sale'],
] as const satisfies readonly (readonly [TieRule, string])[];

export function ConfigPanel({
  config,
  maxImpostors,
  playerCount,
  categories,
  editable,
  categoriesOpen,
  onToggleCategories,
  onChange,
}: ConfigPanelProps) {
  const listId = useId();
  const locked = !editable;
  const set = (patch: Partial<ImpostorConfig>) => {
    onChange({ ...config, ...patch });
  };

  return (
    <ConfigSection titleId="impostor-config-title" locked={locked}>
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
            className="w-10 text-center font-display text-3xl font-bold text-moon tabular-nums"
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

      <Segmented
        labelId="tie-rule-label"
        label="Si hay empate"
        options={TIE_RULES}
        value={config.tieRule}
        disabled={locked}
        onChange={(tieRule) => {
          set({ tieRule });
        }}
        className="grid-cols-2"
      />

      <Switch
        label="Mostrar la categoría al impostor"
        checked={config.showCategoryToImpostor}
        disabled={locked}
        onChange={(showCategoryToImpostor) => {
          set({ showCategoryToImpostor });
        }}
      />

      <div className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={categoriesOpen}
          aria-controls={listId}
          onClick={onToggleCategories}
          className={`flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl text-left ${control}`}
        >
          <span className="flex min-w-0 flex-col">
            <span id="categories-label" className="font-bold">
              Categorías
            </span>
            <span className="text-sm text-cream/60">
              {categorySummary(config.categories, categories)}
            </span>
          </span>
          <ChevronDownIcon
            className={`size-6 text-cream/70 transition-transform duration-200 ease-soft ${categoriesOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {categoriesOpen && categories && (
          <ul id={listId} aria-labelledby="categories-label" className="flex flex-wrap gap-2">
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
                    className={`min-h-12 rounded-full px-4 text-base font-bold ${control} ${
                      on ? chosen : `${unchosen} hover:enabled:bg-cream/6`
                    }`}
                  >
                    {category.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ConfigSection>
  );
}

function categorySummary(selected: string[], categories: WordCategory[] | undefined): string {
  if (!categories) return 'Cargando categorías…';
  const count = categories.filter((category) => selected.includes(category.id)).length;
  return count === categories.length ? 'Todas' : `${String(count)} de ${String(categories.length)}`;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <p className="font-bold">{label}</p>
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
      className={`flex size-12 items-center justify-center rounded-full text-2xl font-bold disabled:opacity-35 ${unchosen} hover:enabled:bg-night-raised motion-safe:active:enabled:scale-95 ${control}`}
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
        <span className="font-bold">{label}</span>
        {hint && <span className="text-sm text-cream/60">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-moon shadow-glow' : 'bg-cream/18'}`}
      >
        <span
          className={`absolute top-1 left-1 size-6 rounded-full bg-night shadow-md transition-transform duration-200 ease-soft ${checked ? 'translate-x-6' : 'translate-x-0'}`}
        />
      </span>
    </button>
  );
}
