const TILTS = [
  '-rotate-2',
  'rotate-1',
  'rotate-[-1deg]',
  'rotate-2',
  'rotate-[-1.5deg]',
  'rotate-[1.5deg]',
];

interface ClueCardProps {
  clue: string;
  index: number;
  author?: string;
  cancelled?: boolean;
  stamp?: string;
}

export function ClueCard({ clue, index, author, cancelled = false, stamp }: ClueCardProps) {
  return (
    <span
      className={`relative flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl px-3 py-4 text-center transition-[background-color,color,box-shadow] duration-200 ${
        TILTS[index % TILTS.length] ?? ''
      } ${cancelled ? 'bg-night-soft text-cream/60 ring-1 ring-cream/12' : 'card-paper'}`}
    >
      <span
        className={`font-display text-xl leading-tight font-bold break-words sm:text-2xl ${
          cancelled ? 'line-through decoration-ember decoration-[3px]' : ''
        }`}
      >
        {clue}
      </span>
      {author && (
        <span className={`text-sm font-semibold ${cancelled ? 'text-cream/55' : 'text-night/65'}`}>
          {author}
        </span>
      )}
      {stamp && (
        <span
          className={`absolute -top-2.5 -right-2 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase shadow-lift ${
            cancelled ? 'bg-ember text-night' : 'bg-sage text-night'
          }`}
        >
          {stamp}
        </span>
      )}
    </span>
  );
}
