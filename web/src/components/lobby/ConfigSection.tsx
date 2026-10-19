import type { ReactNode } from 'react';
import { Enter } from '../../motion/motion';

export const control =
  'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:cursor-default';

export const chosen = 'bg-moon text-night shadow-glow';
export const unchosen = 'bg-night text-cream/80 ring-1 ring-cream/12';

interface ConfigSectionProps {
  titleId: string;
  locked: boolean;
  children: ReactNode;
}

export function ConfigSection({ titleId, locked, children }: ConfigSectionProps) {
  return (
    <Enter
      as="section"
      aria-labelledby={titleId}
      className="flex flex-col gap-6 surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-2xl font-bold">
          Configuración
        </h2>
        {locked && <p className="text-base text-cream/70">Solo el host puede cambiarla.</p>}
      </div>
      {children}
    </Enter>
  );
}

interface SegmentedProps<T extends string | number> {
  labelId: string;
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
  className: string;
}

export function Segmented<T extends string | number>({
  labelId,
  label,
  options,
  value,
  disabled,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="font-bold">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={`grid gap-1.5 rounded-2xl bg-night p-1.5 ring-1 ring-cream/8 ${className}`}
      >
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            onClick={() => {
              if (value !== option) onChange(option);
            }}
            className={`min-h-12 rounded-xl px-3 text-lg font-bold ${control} ${
              value === option ? chosen : 'text-cream/75 hover:enabled:bg-cream/6'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
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

export function StepButton({
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
