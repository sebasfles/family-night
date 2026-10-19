import { place } from '@family-night/shared';

export interface ScoreRow {
  playerId: string;
  from: number;
  to: number;
}

export function byScore(key: 'from' | 'to') {
  return (a: ScoreRow, b: ScoreRow) => b[key] - a[key];
}

export function ranked(rows: ScoreRow[]): (ScoreRow & { rank: number })[] {
  const scores = rows.map((row) => row.to);
  return rows.toSorted(byScore('to')).map((row) => ({ ...row, rank: place(row.to, scores) }));
}
