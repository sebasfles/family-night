import { CowIcon } from '../../components/icons';

interface QuestionCardProps {
  question: string;
  titleId?: string;
}

export function QuestionCard({ question, titleId }: QuestionCardProps) {
  return (
    <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-card px-10 py-7 text-center card-paper sm:px-16">
      <CowIcon className="pointer-events-none absolute -right-6 -bottom-7 size-24 -rotate-12 text-rose/40" />
      <p className="font-sans text-sm font-bold tracking-[0.18em] text-night/65 uppercase">
        La pregunta
      </p>
      <h2
        id={titleId}
        className="relative font-display text-3xl leading-tight font-bold text-balance break-words sm:text-4xl"
      >
        {question}
      </h2>
    </div>
  );
}
