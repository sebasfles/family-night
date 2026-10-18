import { IMPOSTOR_DEFAULTS, type ImpostorConfig, type WordCategory } from '@family-night/shared';
import bank from '../../data/impostor-words.json' with { type: 'json' };

export interface BankEntry {
  id: string;
  category: string;
  categoryName: string;
  word: string;
  clue: string;
}

export const bankEntries: BankEntry[] = bank.categories.flatMap((category) =>
  category.words.map((entry) => ({
    id: entry.id,
    category: category.id,
    categoryName: category.name,
    word: entry.word,
    clue: entry.clue,
  })),
);

export const wordCategories: WordCategory[] = bank.categories.map((category) => ({
  id: category.id,
  name: category.name,
  count: category.words.length,
}));

export function isKnownCategory(id: string): boolean {
  return wordCategories.some((category) => category.id === id);
}

export function categoryWords(categoryId: string): string[] {
  return bankEntries.filter((entry) => entry.category === categoryId).map((entry) => entry.word);
}

export function defaultImpostorConfig(): ImpostorConfig {
  return { ...IMPOSTOR_DEFAULTS, categories: wordCategories.map((category) => category.id) };
}
