import { DIAL_BANDS, DIAL_MAX } from '@family-night/shared';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

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
}

const WIDTH = 260;
const HEIGHT = 150;
const CX = 130;
const CY = 140;
const R = 100;
const LABEL_SPACE = 30;
const BAND_COLORS = ['#f97316', '#ffd166', '#22c55e', '#3b82f6'];
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
}: DialProps) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const interactive = onChange !== undefined && !disabled;

  const set = (next: number) => {
    if (interactive) onChange(clamp(next));
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
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            fromPointer(event);
          }}
          onPointerMove={(event) => {
            if (dragging.current) fromPointer(event);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          <path d={wedge(0, DIAL_MAX)} fill="#241f55" stroke="#fdf6e3" strokeOpacity={0.15} />
          {target !== null &&
            DIAL_BANDS.toReversed().map((band, index) => (
              <path
                key={band.points}
                d={wedge(target - band.within, target + band.within)}
                fill={BAND_COLORS[DIAL_BANDS.length - 1 - index]}
              />
            ))}
          {target !== null &&
            DIAL_BANDS.map((band, index) => {
              const inner = index === 0 ? 0 : (DIAL_BANDS[index - 1]?.within ?? 0);
              const middle =
                index === 0 ? [0] : [-1, 1].map((s) => (s * (inner + band.within)) / 2);
              return middle
                .map((offset) => target + offset)
                .filter((at) => at >= 0 && at <= DIAL_MAX)
                .map((at) => {
                  const [x, y] = point(at, R * 0.8);
                  return (
                    <text
                      key={`${String(band.points)}-${String(at)}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={11}
                      fontWeight={700}
                      fill="#16133a"
                    >
                      {band.points}
                    </text>
                  );
                });
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
                stroke="#fdf6e3"
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
                  fill={marker.highlight ? '#ffd166' : '#fdf6e3'}
                  stroke="#16133a"
                  strokeWidth={2}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={marker.highlight ? 700 : 600}
                  fill={marker.highlight ? '#ffd166' : '#fdf6e3'}
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
                stroke="#ffd166"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <circle cx={needle[0]} cy={needle[1]} r={8} fill="#ffd166" />
            </>
          )}
          <circle cx={CX} cy={CY} r={7} fill="#ffd166" />
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
