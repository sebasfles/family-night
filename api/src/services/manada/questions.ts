import bank from '../../data/manada-questions.json' with { type: 'json' };

export interface ManadaQuestionEntry {
  id: string;
  text: string;
}

export const manadaQuestions: ManadaQuestionEntry[] = bank.questions;
