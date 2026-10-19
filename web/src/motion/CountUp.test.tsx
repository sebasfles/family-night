import { act, render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { spokenText } from '../test/text';
import { stubReducedMotion } from '../test/motion';
import { CountUp } from './CountUp';
import { COUNT_DELAY_MS, COUNT_MS } from './timing';

function shown(container: HTMLElement): string {
  return container.querySelector('[aria-hidden="true"]')?.textContent ?? container.textContent;
}

describe('a counting score', () => {
  test('starts at the old value, climbs and lands on the new one, always read as the new one', () => {
    stubReducedMotion(false);
    vi.useFakeTimers();
    const { container } = render(
      <p>
        <CountUp from={2} to={10} format={(value) => `+${String(value)}`} />
      </p>,
    );

    expect(shown(container)).toBe('+2');
    expect(spokenText(container)).toBe('+10');

    act(() => {
      vi.advanceTimersByTime(COUNT_DELAY_MS + COUNT_MS / 3);
    });
    const midway = Number(shown(container).slice(1));
    expect(midway).toBeGreaterThan(2);
    expect(midway).toBeLessThan(10);
    expect(spokenText(container)).toBe('+10');

    act(() => {
      vi.advanceTimersByTime(COUNT_MS);
    });
    expect(container.textContent).toBe('+10');
  });

  test('with reduced motion shows the new value at once', () => {
    const { container } = render(
      <p>
        <CountUp from={2} to={10} />
      </p>,
    );
    expect(container.textContent).toBe('10');
  });
});
