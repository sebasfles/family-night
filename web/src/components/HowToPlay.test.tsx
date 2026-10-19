import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { HowToPlay, type HowToPlayStep } from './HowToPlay';

const steps: HowToPlayStep[] = ['Uno', 'Dos', 'Tres', 'Cuatro'].map((title) => ({
  title,
  text: `Texto ${title}`,
  Scene: () => <p>Escena {title}</p>,
}));

function stubWide(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') || (wide && query.includes('min-width')),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function open(onClose = vi.fn()) {
  render(<HowToPlay game="Impostor" steps={steps} onClose={onClose} />);
  return onClose;
}

const step = () => screen.getByRole('group').getAttribute('aria-label');

function swipe(dx: number, dy = 0, pointerType = 'touch') {
  const area = screen.getByText(/^Escena/).closest('.touch-pan-y');
  if (!area) throw new Error('no swipe area');
  fireEvent.pointerDown(area, { pointerId: 1, pointerType, clientX: 200, clientY: 300 });
  fireEvent.pointerUp(area, { pointerId: 1, pointerType, clientX: 200 + dx, clientY: 300 + dy });
}

describe('how to play', () => {
  test('previous and next walk the steps; the last step closes with ¡A jugar!', () => {
    const onClose = open();

    expect(screen.getByRole('dialog', { name: 'Impostor' })).toBeVisible();
    expect(step()).toBe('Paso 1 de 4');
    expect(screen.getByRole('heading', { name: 'Uno' })).toBeVisible();
    expect(screen.getByText('Escena Uno')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(step()).toBe('Paso 3 de 4');
    expect(screen.getByText('Escena Tres')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(step()).toBe('Paso 2 de 4');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(step()).toBe('Paso 4 de 4');
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '¡A jugar!' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('a horizontal swipe changes step, a vertical one or a mouse drag does not', () => {
    open();

    swipe(-120);
    expect(step()).toBe('Paso 2 de 4');
    swipe(-120);
    expect(step()).toBe('Paso 3 de 4');
    swipe(120);
    expect(step()).toBe('Paso 2 de 4');

    swipe(-30);
    swipe(-80, 140);
    swipe(-120, 0, 'mouse');
    expect(step()).toBe('Paso 2 de 4');

    swipe(120);
    swipe(120);
    expect(step()).toBe('Paso 1 de 4');
  });

  test('the arrow keys change step and Escape closes', () => {
    const onClose = open();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(step()).toBe('Paso 2 de 4');
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(step()).toBe('Paso 1 de 4');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('on a phone it is a drawer that closes from its handle, by tap or by dragging it down', () => {
    stubWide(false);
    const onClose = open();
    const handle = screen.getByRole('button', { name: 'Arrastra para cerrar' });
    handle.setPointerCapture = vi.fn();

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 50 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 50 });
    fireEvent.click(handle);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 160 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 160 });
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 10 });
    fireEvent.click(handle);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('from 768 px it is a centered modal with no handle, closed with its button', () => {
    stubWide(true);
    const onClose = open();

    expect(screen.queryByRole('button', { name: 'Arrastra para cerrar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
