import type { RoomSnapshot } from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { member, snapshot } from '../test/app';
import { impostorMatch, MATCH_ID } from '../test/impostor-match';
import { JUST_ONE_MATCH_ID, justOneMatch } from '../test/justone-match';
import { WAVELENGTH_MATCH_ID, wavelengthMatch } from '../test/wavelength-match';
import { applyOptimistic } from './optimistic';

const [a, b, c, d] = ['a', 'b', 'c', 'd'];
const players = [a, b, c, d];

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return snapshot({
    hostId: a,
    members: players.map((playerId) => member({ playerId, name: `Jugador ${playerId}` })),
    ...overrides,
  });
}

describe('the optimistic overlay', () => {
  test('a confirmed vote adds only my check, in turn order, and never a target', () => {
    const served = room({
      currentMatch: impostorMatch(players, { order: [d, c, b, a], votedPlayerIds: [d] }),
    });

    const shown = applyOptimistic(served, {
      kind: 'impostor-confirm',
      matchId: MATCH_ID,
      round: 1,
      voterId: b,
      targetId: c,
    });

    expect(shown.currentMatch).toMatchObject({ votedPlayerIds: [d, b] });
    expect(JSON.stringify(shown)).toBe(
      JSON.stringify({
        ...served,
        currentMatch: { ...served.currentMatch, votedPlayerIds: [d, b] },
      }),
    );
  });

  test('a command for another round, phase or match leaves the snapshot as served', () => {
    const voting = room({ currentMatch: impostorMatch(players) });
    const revealing = room({ currentMatch: impostorMatch(players, { phase: 'REVEAL' }) });
    const vote = { kind: 'impostor-confirm', voterId: a, targetId: b } as const;

    expect(applyOptimistic(voting, { ...vote, matchId: MATCH_ID, round: 2 })).toBe(voting);
    expect(applyOptimistic(voting, { ...vote, matchId: 'other', round: 1 })).toBe(voting);
    expect(applyOptimistic(revealing, { ...vote, matchId: MATCH_ID, round: 1 })).toBe(revealing);
    expect(
      applyOptimistic(voting, { ...vote, voterId: a, targetId: a, matchId: MATCH_ID, round: 1 }),
    ).toBe(voting);
  });

  test('the psychic’s clue opens guessing with that clue; a guesser’s commit adds only them', () => {
    const clue = room({ currentMatch: wavelengthMatch(players) });
    const opened = applyOptimistic(clue, {
      kind: 'wavelength-clue',
      matchId: WAVELENGTH_MATCH_ID,
      round: 1,
      psychicId: a,
      clue: 'Sopa',
    });
    expect(opened.currentMatch).toMatchObject({ phase: 'GUESS', clue: 'Sopa' });
    expect(
      applyOptimistic(clue, {
        kind: 'wavelength-clue',
        matchId: WAVELENGTH_MATCH_ID,
        round: 1,
        psychicId: b,
        clue: 'Sopa',
      }),
    ).toBe(clue);

    const guessing = room({
      currentMatch: wavelengthMatch(players, {
        phase: 'GUESS',
        clue: 'Sopa',
        committedPlayerIds: [d],
      }),
    });
    const committed = applyOptimistic(guessing, {
      kind: 'wavelength-commit',
      matchId: WAVELENGTH_MATCH_ID,
      round: 1,
      playerId: b,
    });
    expect(committed.currentMatch).toMatchObject({ committedPlayerIds: [b, d] });
  });

  test('a Just One clue counts me and a crossed clue toggles, without any clue text', () => {
    const clues = room({ currentMatch: justOneMatch(players) });
    const mine = applyOptimistic(clues, {
      kind: 'justone-clue',
      matchId: JUST_ONE_MATCH_ID,
      round: 1,
      playerId: c,
    });
    expect(mine.currentMatch).toMatchObject({ committedPlayerIds: [c], clues: null });

    const review = room({
      currentMatch: justOneMatch(players, {
        phase: 'REVIEW',
        committedPlayerIds: [b, c, d],
        cancelledAuthorIds: [d],
      }),
    });
    const crossed = applyOptimistic(review, {
      kind: 'justone-cancel',
      matchId: JUST_ONE_MATCH_ID,
      round: 1,
      playerId: b,
      authorId: c,
      cancelled: true,
    });
    expect(crossed.currentMatch).toMatchObject({ cancelledAuthorIds: [c, d] });
    const restored = applyOptimistic(crossed, {
      kind: 'justone-cancel',
      matchId: JUST_ONE_MATCH_ID,
      round: 1,
      playerId: b,
      authorId: d,
      cancelled: false,
    });
    expect(restored.currentMatch).toMatchObject({ cancelledAuthorIds: [c] });
  });

  test('lobby commands show the new host, the kicked member gone, a new name and a config', () => {
    const lobby = room();
    expect(applyOptimistic(lobby, { kind: 'host', playerId: c }).hostId).toBe(c);
    expect(
      applyOptimistic(lobby, { kind: 'kick', playerId: c }).members.map((m) => m.playerId),
    ).toEqual([a, b, d]);
    expect(
      applyOptimistic(lobby, { kind: 'rename', playerId: b, name: 'Tía Marta' }).members.map(
        (m) => m.name,
      ),
    ).toEqual(['Jugador a', 'Tía Marta', 'Jugador c', 'Jugador d']);
    const configured = applyOptimistic(lobby, {
      kind: 'config',
      request: { gameType: 'WAVELENGTH', config: { cycles: 3 } },
    });
    expect(configured.selectedGame).toBe('WAVELENGTH');
    expect(configured.configs.WAVELENGTH).toEqual({ cycles: 3 });
    expect(configured.configs.IMPOSTOR).toBe(lobby.configs.IMPOSTOR);
  });
});
