import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { stubReducedMotion } from '../test/motion';
import { Flip, FlipReveal } from './Flip';
import { REVEAL_FLIP_DELAY_MS } from './timing';

function turner(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-flip]');
  if (!element) throw new Error('no flip');
  return element;
}

describe('a reveal', () => {
  test('shows the back, then turns over in 3D to the face', () => {
    stubReducedMotion(false);
    vi.useFakeTimers();
    render(<FlipReveal back={<span>Dorso</span>}>Era impostor</FlipReveal>);

    expect(screen.getByText('Dorso')).toBeInTheDocument();
    expect(screen.queryByText('Era impostor')).toBeNull();
    expect(turner().style.transform).toBe('rotateY(0deg)');

    act(() => {
      vi.advanceTimersByTime(REVEAL_FLIP_DELAY_MS);
    });

    expect(screen.getByText('Era impostor')).toBeInTheDocument();
    expect(turner().style.transform).toBe('rotateY(180deg)');
    expect(turner().className).toContain('transform-3d');
    expect(screen.getByText('Dorso').closest('[aria-hidden]')).not.toBeNull();
  });

  test('with reduced motion shows the face at once, with no back and no turn', () => {
    render(<FlipReveal back={<span>Dorso</span>}>Era impostor</FlipReveal>);

    expect(screen.getByText('Era impostor')).toBeVisible();
    expect(screen.queryByText('Dorso')).toBeNull();
    expect(document.querySelector('[data-flip]')).toBeNull();
  });
});

function Toggle() {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setFlipped(!flipped);
      }}
    >
      <Flip flipped={flipped} back="Toca para ver" front="Palta" />
    </button>
  );
}

describe('a card turned by hand', () => {
  test('keeps its face until it has turned away, then drops it', () => {
    stubReducedMotion(false);
    render(<Toggle />);
    const card = screen.getByRole('button');
    expect(screen.queryByText('Palta')).toBeNull();

    fireEvent.click(card);
    expect(screen.getByText('Palta')).toBeInTheDocument();
    expect(card).toHaveAccessibleName('Palta');

    fireEvent.click(card);
    expect(turner().style.transform).toBe('rotateY(0deg)');
    expect(screen.getByText('Palta')).toBeInTheDocument();
    fireEvent.transitionEnd(turner());
    expect(screen.queryByText('Palta')).toBeNull();
    expect(card).toHaveAccessibleName('Toca para ver');
  });

  test('with reduced motion swaps sides at once', () => {
    render(<Toggle />);
    const card = screen.getByRole('button');

    fireEvent.click(card);
    expect(screen.getByText('Palta')).toBeVisible();
    expect(screen.queryByText('Toca para ver')).toBeNull();
    fireEvent.click(card);
    expect(screen.queryByText('Palta')).toBeNull();
  });
});
