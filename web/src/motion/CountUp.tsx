import { useEffect, useState } from 'react';
import { COUNT_DELAY_MS, COUNT_MS } from './timing';
import { useReducedMotion } from './useReducedMotion';

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function useCountUp(from: number, to: number, delayMs = COUNT_DELAY_MS): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (reduced) return;
    let start: number | null = null;
    let frame = requestAnimationFrame(function step(now) {
      start ??= now + delayMs;
      const progress = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      setValue(Math.round(from + (to - from) * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [from, to, delayMs, reduced]);

  return reduced ? to : value;
}

interface CountUpProps {
  from: number;
  to: number;
  delayMs?: number;
  format?: (value: number) => string;
}

export function CountUp({ from, to, delayMs, format = String }: CountUpProps) {
  const value = useCountUp(from, to, delayMs);
  if (value === to) return format(to);
  return (
    <>
      <span aria-hidden="true">{format(value)}</span>
      <span className="sr-only">{format(to)}</span>
    </>
  );
}
