import { useLayoutEffect, useRef } from 'react';
import { EASE_SOFT, SHIFT_DELAY_MS, SHIFT_MS } from './timing';
import { useReducedMotion } from './useReducedMotion';

export interface RowBox {
  id: string;
  top: number;
  height: number;
}

export function shiftOffsets(
  rows: RowBox[],
  fromOrder: string[],
  gap: number,
): Map<string, number> {
  const offsets = new Map<string, number>();
  if (rows.length === 0) return offsets;
  const byId = new Map(rows.map((row) => [row.id, row]));
  let top = Math.min(...rows.map((row) => row.top));
  for (const id of fromOrder) {
    const row = byId.get(id);
    if (!row) continue;
    offsets.set(id, top - row.top);
    top += row.height + gap;
  }
  return offsets;
}

export function useShuffleIn<T extends HTMLElement>(fromOrder: string[]) {
  const list = useRef<T>(null);
  const reduced = useReducedMotion();
  const from = useRef(fromOrder);

  useLayoutEffect(() => {
    const element = list.current;
    if (reduced || !element) return;
    const rows = Array.from(element.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.dataset.row !== undefined,
    );
    if (rows.some((row) => typeof row.animate !== 'function')) return;
    const gap = Number.parseFloat(getComputedStyle(element).rowGap) || 0;
    const offsets = shiftOffsets(
      rows.map((row) => ({
        id: row.dataset.row ?? '',
        top: row.offsetTop,
        height: row.offsetHeight,
      })),
      from.current,
      gap,
    );
    const animations = rows.flatMap((row) => {
      const offset = offsets.get(row.dataset.row ?? '') ?? 0;
      if (Math.abs(offset) < 1) return [];
      return [
        row.animate(
          [{ transform: `translateY(${String(offset)}px)` }, { transform: 'translateY(0)' }],
          { duration: SHIFT_MS, delay: SHIFT_DELAY_MS, easing: EASE_SOFT, fill: 'backwards' },
        ),
      ];
    });
    return () => {
      for (const animation of animations) animation.cancel();
    };
  }, [reduced]);

  return list;
}
