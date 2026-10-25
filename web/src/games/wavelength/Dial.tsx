import { DIAL_BANDS, DIAL_MAX } from '@family-night/shared';
import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { FlipReveal } from '../../motion/Flip';
import { playTick, unlockTick } from './tick';

export interface DialMarker {
  id: string;
  value: number;
  label: string;
  highlight?: boolean;
}

interface DialProps {
  label: string;
  left: string;
  right: string;
  value?: number | null;
  target?: number | null;
  markers?: DialMarker[];
  onChange?: (value: number) => void;
  disabled?: boolean;
  sound?: boolean;
  reveal?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

const WIDTH = 260;
const HEIGHT = 150;
const CX = 130;
const CY = 140;
const R = 100;
const LABEL_SPACE = 30;
const BAND_FILLS = ['fill-moon-bright', 'fill-ember', 'fill-orchid'];
const LABEL_MIN_WIDTH = 2;
const STEP_KEYS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -10,
  PageUp: 10,
};

function clamp(value: number): number {
  return Math.min(DIAL_MAX, Math.max(0, Math.round(value)));
}

function point(value: number, radius: number): [number, number] {
  const angle = Math.PI * (1 - value / DIAL_MAX);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function arc(from: number, to: number, radius: number): string {
  const [x1, y1] = point(from, radius);
  const [x2, y2] = point(to, radius);
  return `M${fmt(x1)} ${fmt(y1)} A${String(radius)} ${String(radius)} 0 0 1 ${fmt(x2)} ${fmt(y2)}`;
}

function wedge(from: number, to: number): string {
  const [x1, y1] = point(Math.max(0, from), R);
  const [x2, y2] = point(Math.min(DIAL_MAX, to), R);
  return `M${String(CX)} ${String(CY)} L${fmt(x1)} ${fmt(y1)} A${String(R)} ${String(R)} 0 0 1 ${fmt(x2)} ${fmt(y2)} Z`;
}

interface BandLabel {
  points: number;
  at: number;
}

function bandEdge(index: number): number {
  return index < 0 ? -0.5 : (DIAL_BANDS[index]?.within ?? 0) + 0.5;
}

function bandLabels(target: number): BandLabel[] {
  return DIAL_BANDS.flatMap((band, index) => {
    const inner = bandEdge(index - 1);
    const outer = bandEdge(index);
    const segments: [number, number][] =
      index === 0
        ? [[target - outer, target + outer]]
        : [
            [target - outer, target - inner],
            [target + inner, target + outer],
          ];
    return segments.flatMap(([from, to]) => {
      const lo = Math.max(0, from);
      const hi = Math.min(DIAL_MAX, to);
      return hi - lo >= LABEL_MIN_WIDTH ? [{ points: band.points, at: (lo + hi) / 2 }] : [];
    });
  });
}

function staggered(markers: DialMarker[]): (DialMarker & { lift: number })[] {
  const sorted = markers.toSorted((a, b) => a.value - b.value);
  return sorted.map((marker, index) => {
    const previous = sorted[index - 1];
    const crowded = previous !== undefined && marker.value - previous.value < 8;
    return { ...marker, lift: crowded && index % 2 === 1 ? 26 : 13 };
  });
}

export function Dial({
  label,
  left,
  right,
  value = null,
  target = null,
  markers = [],
  onChange,
  disabled = false,
  sound = false,
  reveal = false,
  autoFocus = false,
  onSubmit,
}: DialProps) {
  const svg = useRef<SVGSVGElement>(null);
  const slider = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const interactive = onChange !== undefined && !disabled;

  useEffect(() => {
    if (autoFocus) slider.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const set = (next: number) => {
    if (!interactive) return;
    const clamped = clamp(next);
    if (clamped === value) return;
    onChange(clamped);
    if (sound) playTick();
  };

  const fromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = ((event.clientX - rect.left) * WIDTH) / rect.width;
    const y = top + ((event.clientY - rect.top) * (HEIGHT - top)) / rect.height;
    const angle = Math.atan2(CY - y, x - CX);
    const bounded = angle < 0 ? (x < CX ? Math.PI : 0) : angle;
    set((1 - bounded / Math.PI) * DIAL_MAX);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (sound) unlockTick();
    const step = STEP_KEYS[event.key];
    const current = value ?? DIAL_MAX / 2;
    if (step !== undefined) set(current + step);
    else if (event.key === 'Enter' && onSubmit) {
      if (!event.repeat) onSubmit();
    } else if (event.key === 'Home') set(0);
    else if (event.key === 'End') set(DIAL_MAX);
    else return;
    event.preventDefault();
  };

  const needle = value === null ? null : point(value, R - 10);
  const top = markers.length > 0 ? 0 : LABEL_SPACE;
  const viewBox = `0 ${String(top)} ${String(WIDTH)} ${String(HEIGHT - top)}`;
  const bands = target === null ? null : <Bands target={target} viewBox={viewBox} />;

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        ref={slider}
        role={onChange ? 'slider' : 'img'}
        aria-label={label}
        {...(onChange
          ? {
              tabIndex: disabled ? -1 : 0,
              'aria-valuemin': 0,
              'aria-valuemax': DIAL_MAX,
              'aria-valuenow': value ?? DIAL_MAX / 2,
              'aria-valuetext': `${String(value ?? DIAL_MAX / 2)} de ${String(DIAL_MAX)}, entre ${left} y ${right}`,
              'aria-disabled': disabled || undefined,
            }
          : {})}
        onKeyDown={onKeyDown}
        className="relative rounded-3xl focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
      >
        <svg viewBox={viewBox} className="block w-full" aria-hidden="true">
          <defs>
            <radialGradient id={`${ids}-face`} cx={CX} cy={CY} r={R} gradientUnits="userSpaceOnUse">
              <stop offset="0" style={{ stopColor: 'var(--color-night-raised)' }} />
              <stop offset="1" style={{ stopColor: 'var(--color-night-soft)' }} />
            </radialGradient>
            <linearGradient
              id={`${ids}-rim`}
              x1={CX - R}
              x2={CX + R}
              y1={0}
              y2={0}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" style={{ stopColor: 'var(--color-lagoon)' }} />
              <stop offset="0.5" style={{ stopColor: 'var(--color-sand)' }} />
              <stop offset="1" style={{ stopColor: 'var(--color-ember)' }} />
            </linearGradient>
          </defs>
          <path
            d={wedge(0, DIAL_MAX)}
            fill={`url(#${ids}-face)`}
            className="stroke-cream"
            strokeOpacity={0.12}
          />
          <path
            d={arc(0, DIAL_MAX, R + 5)}
            fill="none"
            stroke={`url(#${ids}-rim)`}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </svg>

        {bands && (
          <div data-layer="bands" className="absolute inset-0">
            {reveal ? (
              <FlipReveal back={<Shutter viewBox={viewBox} pattern={`${ids}-shutter`} />}>
                {bands}
              </FlipReveal>
            ) : (
              bands
            )}
          </div>
        )}

        <svg
          ref={svg}
          data-layer="hand"
          viewBox={viewBox}
          className={`absolute inset-0 block size-full select-none ${interactive ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
          aria-hidden="true"
          onPointerDown={(event) => {
            if (!interactive) return;
            if (sound) unlockTick();
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            fromPointer(event);
          }}
          onPointerMove={(event) => {
            if (dragging.current) fromPointer(event);
          }}
          onPointerUp={() => {
            dragging.current = false;
            if (interactive && sound) unlockTick();
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          {Array.from({ length: 21 }, (_, i) => i * 5).map((at) => {
            const major = at % 10 === 0;
            const [x1, y1] = point(at, R);
            const [x2, y2] = point(at, R - (major ? 8 : 4));
            return (
              <line
                key={at}
                x1={fmt(x1)}
                y1={fmt(y1)}
                x2={fmt(x2)}
                y2={fmt(y2)}
                className="stroke-cream"
                strokeOpacity={major ? 0.5 : 0.25}
                strokeWidth={major ? 1.5 : 1}
                strokeLinecap="round"
              />
            );
          })}
          {staggered(markers).map((marker) => {
            const [x, y] = point(marker.value, R);
            const [lx, ly] = point(marker.value, R + marker.lift);
            return (
              <g key={marker.id} data-marker={marker.id}>
                <circle
                  cx={fmt(x)}
                  cy={fmt(y)}
                  r={5.5}
                  className={`stroke-night ${marker.highlight ? 'fill-moon' : 'fill-cream'}`}
                  strokeWidth={2.5}
                />
                <text
                  x={fmt(lx)}
                  y={fmt(ly)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={marker.highlight ? 800 : 700}
                  paintOrder="stroke"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  className={`stroke-night ${marker.highlight ? 'fill-moon' : 'fill-cream'}`}
                >
                  {marker.label}
                </text>
              </g>
            );
          })}
          {needle && (
            <g className="drop-shadow-[0_0_5px_rgb(246_178_60/0.55)]">
              <line
                x1={CX}
                y1={CY}
                x2={fmt(needle[0])}
                y2={fmt(needle[1])}
                className="stroke-moon"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <circle
                cx={fmt(needle[0])}
                cy={fmt(needle[1])}
                r={9}
                className="fill-moon-bright stroke-night"
                strokeWidth={2.5}
              />
            </g>
          )}
          <circle data-hub cx={CX} cy={CY} r={7} className="fill-moon" />
          <circle cx={CX} cy={CY} r={2.5} className="fill-night" />
        </svg>
      </div>
      <div className="flex items-start justify-between gap-3 font-display text-base font-bold sm:text-lg">
        <span className="flex max-w-[48%] gap-1 break-words text-lagoon">
          <span aria-hidden="true">←</span>
          {left}
        </span>
        <span className="flex max-w-[48%] justify-end gap-1 text-right break-words text-ember">
          {right}
          <span aria-hidden="true">→</span>
        </span>
      </div>
      {onChange && !disabled && (
        <div className="flex items-center justify-center gap-5">
          <StepButton
            label="Un punto hacia la izquierda"
            disabled={value === 0}
            onClick={() => {
              if (sound) unlockTick();
              set((value ?? DIAL_MAX / 2) - 1);
            }}
          >
            −
          </StepButton>
          <output
            aria-live="polite"
            className="w-16 text-center font-display text-4xl font-bold text-moon tabular-nums"
          >
            {value ?? DIAL_MAX / 2}
          </output>
          <StepButton
            label="Un punto hacia la derecha"
            disabled={value === DIAL_MAX}
            onClick={() => {
              if (sound) unlockTick();
              set((value ?? DIAL_MAX / 2) + 1);
            }}
          >
            +
          </StepButton>
        </div>
      )}
    </div>
  );
}

function Bands({ target, viewBox }: { target: number; viewBox: string }) {
  return (
    <svg viewBox={viewBox} className="block w-full" aria-hidden="true">
      {DIAL_BANDS.map((band, index) => ({ band, index }))
        .toReversed()
        .map(({ band, index }) => (
          <path
            key={band.points}
            data-points={band.points}
            d={wedge(target - bandEdge(index), target + bandEdge(index))}
            className={`${BAND_FILLS[index] ?? ''} stroke-night`}
            strokeOpacity={0.35}
            strokeWidth={0.75}
          />
        ))}
      {bandLabels(target).map(({ points, at }) => {
        const [x, y] = point(at, R * 0.8);
        return (
          <text
            key={`${String(points)}-${String(at)}`}
            x={fmt(x)}
            y={fmt(y)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={800}
            className="fill-night font-display"
          >
            {points}
          </text>
        );
      })}
    </svg>
  );
}

function Shutter({ viewBox, pattern }: { viewBox: string; pattern: string }) {
  return (
    <svg viewBox={viewBox} className="block w-full" aria-hidden="true">
      <defs>
        <pattern
          id={pattern}
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={10} height={10} className="fill-night-raised" />
          <rect width={2} height={10} className="fill-moon" fillOpacity={0.16} />
        </pattern>
      </defs>
      <path
        d={wedge(0, DIAL_MAX)}
        fill={`url(#${pattern})`}
        className="stroke-moon"
        strokeOpacity={0.45}
        strokeWidth={1.5}
      />
      <text
        x={CX}
        y={CY - R * 0.48}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={34}
        fontWeight={700}
        className="fill-cream font-display"
        fillOpacity={0.75}
      >
        ?
      </text>
    </svg>
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
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-14 items-center justify-center rounded-full bg-night-raised text-3xl font-bold text-cream ring-1 ring-cream/15 transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:opacity-40 motion-safe:active:scale-95"
    >
      {children}
    </button>
  );
}
