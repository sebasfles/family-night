import { DIAL_MAX, dialPoints } from '@family-night/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { Dial } from './Dial';

function Controlled({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState(50);
  return (
    <Dial
      label="Tu respuesta"
      left="Frío"
      right="Caliente"
      value={value}
      disabled={disabled}
      onChange={setValue}
    />
  );
}

function renderDial(disabled = false) {
  render(<Controlled disabled={disabled} />);
  const svg = document.querySelector('svg');
  if (!svg) throw new Error('no dial');
  svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 520, height: 240 });
  svg.setPointerCapture = vi.fn();
  return { svg, slider: screen.getByRole('slider', { name: 'Tu respuesta' }) };
}

describe('the dial', () => {
  test('dragging follows the finger along the half circle, to the point', () => {
    const { svg, slider } = renderDial();

    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 260, clientY: 20 });
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 60, clientY: 219 });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 400, clientY: 80 });
    expect(slider).toHaveAttribute('aria-valuenow', '75');
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 500, clientY: 239 });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    fireEvent.pointerUp(svg, { pointerId: 1 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 60, clientY: 219 });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    expect(slider).toHaveAttribute('aria-valuetext', '100 de 100, entre Frío y Caliente');
  });

  test('a locked dial ignores drag, keys and buttons', () => {
    const { svg, slider } = renderDial(true);

    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 60, clientY: 219 });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('a read-only dial is an image with no controls', () => {
    render(<Dial label="El objetivo" left="Frío" right="Caliente" target={40} />);
    expect(screen.getByRole('img', { name: 'El objetivo' })).toBeVisible();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Frío')).toBeVisible();
    expect(screen.getByText('Caliente')).toBeVisible();
  });
});

function bandLabels(target: number): { points: number; value: number }[] {
  render(<Dial label="El objetivo" left="Frío" right="Caliente" target={target} />);
  const svg = document.querySelector('svg');
  const hub = svg?.querySelector('circle[r="7"]');
  if (!svg || !hub) throw new Error('no dial');
  const cx = Number(hub.getAttribute('cx'));
  const cy = Number(hub.getAttribute('cy'));
  return Array.from(svg.querySelectorAll('text')).map((text) => {
    const angle = Math.atan2(
      cy - Number(text.getAttribute('y')),
      Number(text.getAttribute('x')) - cx,
    );
    return { points: Number(text.textContent), value: (1 - angle / Math.PI) * DIAL_MAX };
  });
}

describe('the scoring zones', () => {
  test.each([0, 3, 50, 97, 100])(
    'around a target at %i every number sits on the zone it scores',
    (target) => {
      const labels = bandLabels(target);

      expect(labels.map((label) => label.points)).toContain(4);
      for (const label of labels) {
        expect(label.value).toBeGreaterThanOrEqual(0);
        expect(label.value).toBeLessThanOrEqual(DIAL_MAX);
        expect(dialPoints(Math.round(label.value), target), JSON.stringify(label)).toBe(
          label.points,
        );
      }
    },
  );

  test('each zone spans half a point past the last whole value it scores', () => {
    render(<Dial label="El objetivo" left="Frío" right="Caliente" target={50} />);
    const svg = document.querySelector('svg');
    const hub = svg?.querySelector('circle[r="7"]');
    if (!svg || !hub) throw new Error('no dial');
    const cx = Number(hub.getAttribute('cx'));
    const cy = Number(hub.getAttribute('cy'));
    const valueAt = (x: number, y: number) => (1 - Math.atan2(cy - y, x - cx) / Math.PI) * DIAL_MAX;
    const zones = Array.from(svg.querySelectorAll('path'))
      .slice(1)
      .map((path) => {
        const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
        const [, , x1 = 0, y1 = 0] = numbers;
        const [x2 = 0, y2 = 0] = numbers.slice(-2);
        return [valueAt(x1, y1), valueAt(x2, y2)].map((value) => Number(value.toFixed(1)));
      });

    expect(zones).toEqual([
      [37.5, 62.5],
      [42.5, 57.5],
      [47.5, 52.5],
    ]);
  });

  test('a centred target shows 4 once and 3 and 2 on both sides', () => {
    expect(
      bandLabels(50)
        .map((label) => label.points)
        .toSorted(),
    ).toEqual([2, 2, 3, 3, 4]);
  });
});
