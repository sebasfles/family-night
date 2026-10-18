export type RandomInt = (maxExclusive: number) => number;

export function shuffle<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const current = result[i] as T;
    result[i] = result[j] as T;
    result[j] = current;
  }
  return result;
}
