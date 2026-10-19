export function AnswerCard({ answer }: { answer: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="font-sans text-sm font-bold tracking-[0.18em] text-cream/70 uppercase">
        Tu respuesta
      </p>
      <p className="max-w-full rotate-[-1.5deg] rounded-2xl px-6 py-4 font-display text-3xl leading-tight font-bold break-words card-paper">
        {answer}
      </p>
    </div>
  );
}
