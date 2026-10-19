import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SHIFT_DELAY_MS } from '../motion/timing';
import { member } from '../test/app';
import { stubReducedMotion } from '../test/motion';
import { spokenText } from '../test/text';
import { Scoreboard } from './Scoreboard';

const members = [
  member({ playerId: 'a', name: 'Ana' }),
  member({ playerId: 'b', name: 'Beto' }),
  member({ playerId: 'c', name: 'Cata' }),
];
const rows = [
  { playerId: 'a', from: 3, to: 3 },
  { playerId: 'b', from: 0, to: 5 },
  { playerId: 'c', from: 1, to: 1 },
];
const ROW_HEIGHT = 40;

const animate = vi.fn<(keyframes: Keyframe[], options: KeyframeAnimationOptions) => object>(() => ({
  cancel: vi.fn(),
}));

function layOutRows() {
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(ROW_HEIGHT);
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    const siblings = Array.from(this.parentElement?.children ?? []);
    return siblings.indexOf(this) * ROW_HEIGHT;
  });
}

function shiftOf(name: string): string | undefined {
  const row = screen.getByText(name).closest('li');
  const call = animate.mock.calls.find((_, index) => animate.mock.contexts[index] === row);
  return call?.[0][0]?.transform as string | undefined;
}

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  animate.mockClear();
});

describe('a scoreboard', () => {
  test('ranks by the new points and moves each row up or down from its old place', () => {
    stubReducedMotion(false);
    layOutRows();
    render(<Scoreboard title="Puntaje" rows={rows} members={members} selfId="a" />);

    const list = screen.getByRole('list', { name: 'Puntaje' });
    expect(within(list).getAllByRole('listitem').map(spokenText)).toEqual([
      '1Beto5',
      '2Ana(tú)3',
      '3Cata1',
    ]);
    expect(shiftOf('Beto')).toBe(`translateY(${String(2 * ROW_HEIGHT)}px)`);
    expect(shiftOf('Ana')).toBe(`translateY(${String(-ROW_HEIGHT)}px)`);
    expect(shiftOf('Cata')).toBe(`translateY(${String(-ROW_HEIGHT)}px)`);
    expect(animate.mock.calls[0]?.[1]).toMatchObject({ delay: SHIFT_DELAY_MS, fill: 'backwards' });
  });

  test('with reduced motion stands in its final order without moving', () => {
    layOutRows();
    render(<Scoreboard title="Puntaje" rows={rows} members={members} selfId="a" signed />);

    expect(
      within(screen.getByRole('list', { name: 'Puntaje' }))
        .getAllByRole('listitem')
        .map(spokenText),
    ).toEqual(['1Beto+5', '2Ana(tú)+3', '3Cata+1']);
    expect(animate).not.toHaveBeenCalled();
  });
});
