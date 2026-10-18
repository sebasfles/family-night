import bank from '../../data/justone-words.json' with { type: 'json' };

export interface JustOneWord {
  id: string;
  word: string;
}

export const justOneWords: JustOneWord[] = bank.words;
