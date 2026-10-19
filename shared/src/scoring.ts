export function place(score: number, scores: readonly number[]): number {
  return 1 + scores.filter((other) => other > score).length;
}

export function podiumPoints(
  totals: Readonly<Record<string, number>>,
  playerIds: readonly string[],
): Record<string, number> {
  const scores = playerIds.map((id) => totals[id] ?? 0);
  return Object.fromEntries(
    playerIds.map((id) => [id, playerIds.length - place(totals[id] ?? 0, scores) + 1]),
  );
}
