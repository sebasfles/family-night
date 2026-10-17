import names from '../data/names.json' with { type: 'json' };

export const NAME_ATTEMPTS = 20;

function pick(list: readonly string[], random: () => number): string {
  const item = list[Math.floor(random() * list.length)];
  if (item === undefined) throw new Error('random() must return a number in [0, 1)');
  return item;
}

export function randomName(random: () => number): string {
  return `${pick(names.animals, random)} ${pick(names.adjectives, random)}`;
}

export function suffixedName(base: string, attempt: number): string {
  return attempt <= NAME_ATTEMPTS ? base : `${base} ${String(attempt - NAME_ATTEMPTS + 1)}`;
}
