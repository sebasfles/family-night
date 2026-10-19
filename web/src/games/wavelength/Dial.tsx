import { DIAL_BANDS, DIAL_MAX } from '@family-night/shared';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
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
}

const WIDTH = 260;
const HEIGHT = 150;
const CX = 130;
const CY = 140;
const R = 100;
const LABEL_SPACE = 30;
const BAND_COLORS = ['#f97316', '#ffd166', '#22c55e'];
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
}: DialProps) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const interactive = onChange !== undefined && !disabled;

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
    else if (event.key === 'Home') set(0);
    else if (event.key === 'End') set(DIAL_MAX);
    else return;
    event.preventDefault();
  };

  const needle = value === null ? null : point(value, R - 8);
  const top = markers.length > 0 ? 0 : LABEL_SPACE;

  return (
    <div className="flex w-full flex-col gap-2">
      <div
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
        className="rounded-3xl focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
      >
        <svg
          ref={svg}
          viewBox={`0 ${String(top)} ${String(WIDTH)} ${String(HEIGHT - top)}`}
          className={`block w-full select-none ${interactive ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
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
          <path
            d={wedge(0, DIAL_MAX)}
            className="fill-night-soft stroke-cream"
            strokeOpacity={0.15}
          />
          {target !== null &&
            DIAL_BANDS.map((band, index) => ({ band, index }))
              .toReversed()
              .map(({ band, index }) => (
                <path
                  key={band.points}
                  d={wedge(target - bandEdge(index), target + bandEdge(index))}
                  fill={BAND_COLORS[index]}
                />
              ))}
          {target !== null &&
            bandLabels(target).map(({ points, at }) => {
              const [x, y] = point(at, R * 0.82);
              return (
                <text
                  key={`${String(points)}-${String(at)}`}
                  x={fmt(x)}
                  y={fmt(y)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={700}
                  className="fill-night"
                >
                  {points}
                </text>
              );
            })}
          {Array.from({ length: 11 }, (_, i) => i * 10).map((at) => {
            const [x1, y1] = point(at, R);
            const [x2, y2] = point(at, R - 6);
            return (
              <line
                key={at}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="stroke-cream"
                strokeOpacity={0.4}
                strokeWidth={1.5}
              />
            );
          })}
          {staggered(markers).map((marker) => {
            const [x, y] = point(marker.value, R);
            const [lx, ly] = point(marker.value, R + marker.lift);
            return (
              <g key={marker.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={5}
                  className={`stroke-night ${marker.highlight ? 'fill-moon' : 'fill-cream'}`}
                  strokeWidth={2}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={marker.highlight ? 700 : 600}
                  className={marker.highlight ? 'fill-moon' : 'fill-cream'}
                >
                  {marker.label}
                </text>
              </g>
            );
          })}
          {needle && (
            <>
              <line
                x1={CX}
                y1={CY}
                x2={needle[0]}
                y2={needle[1]}
                className="stroke-moon"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <circle cx={needle[0]} cy={needle[1]} r={8} className="fill-moon" />
            </>
          )}
          <circle cx={CX} cy={CY} r={7} className="fill-moon" />
        </svg>
      </div>
      <div className="flex items-start justify-between gap-3 text-lg font-bold">
        <span className="max-w-[45%] break-words text-sky-300">{left}</span>
        <span className="max-w-[45%] text-right break-words text-orange-300">{right}</span>
      </div>
      {onChange && !disabled && (
        <div className="flex items-center justify-center gap-4">
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
          <output aria-live="polite" className="w-14 text-center text-3xl font-bold tabular-nums">
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
      className="flex size-12 items-center justify-center rounded-full bg-night-soft text-2xl font-bold ring-1 ring-cream/15 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
