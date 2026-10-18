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
