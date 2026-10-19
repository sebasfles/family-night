export interface ScoreRow {
  playerId: string;
  from: number;
  to: number;
}

export function byScore(key: 'from' | 'to') {
  return (a: ScoreRow, b: ScoreRow) => b[key] - a[key];
}

export function ranked(rows: ScoreRow[]): (ScoreRow & { rank: number })[] {
  return rows
    .toSorted(byScore('to'))
    .map((row, _, all) => ({ ...row, rank: 1 + all.filter((other) => other.to > row.to).length }));
}
