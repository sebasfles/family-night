import { sameAnswer } from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { manadaQuestions } from './questions.ts';

describe('manada-questions.json', () => {
  test('has about 200 questions with unique stable ids', () => {
    expect(manadaQuestions.length).toBeGreaterThanOrEqual(190);
    const ids = manadaQuestions.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test('every question is a short Spanish prompt, none repeated', () => {
    for (const { text } of manadaQuestions) {
      expect(text, text).toMatch(/^\p{Lu}/u);
      expect(text.length, text).toBeLessThanOrEqual(60);
    }
    const repeated = manadaQuestions.flatMap((a, i) =>
      manadaQuestions.slice(i + 1).flatMap((b) => (sameAnswer(a.text, b.text) ? [a.text] : [])),
    );
    expect(repeated).toEqual([]);
  });
});
