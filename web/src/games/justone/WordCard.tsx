import { CluesIcon } from '../../components/icons';

export function WordCard({ word }: { word: string | undefined }) {
  return (
    <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-card px-6 py-7 text-center card-paper">
      <CluesIcon className="pointer-events-none absolute -right-4 -bottom-5 size-24 -rotate-12 text-orchid/40" />
      <h2
        id="word-title"
        className="font-sans text-sm font-bold tracking-[0.18em] text-night/65 uppercase"
      >
        La palabra secreta
      </h2>
      <p className="font-display text-5xl leading-tight font-bold break-words">{word ?? '…'}</p>
    </div>
  );
}

export function WordBack() {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-card card-back [--card-accent:var(--color-orchid)]">
      <span className="flex size-20 items-center justify-center rounded-full bg-night text-orchid shadow-lift ring-1 ring-orchid/40">
        <CluesIcon className="size-12" />
      </span>
    </div>
  );
}
