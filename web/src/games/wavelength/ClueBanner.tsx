interface ClueBannerProps {
  titleId?: string;
  title: string;
  clue: string | null;
}

export function ClueBanner({ titleId, title, clue }: ClueBannerProps) {
  return (
    <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-card px-6 pt-8 pb-6 text-center card-paper">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-2 bg-linear-to-r from-lagoon via-sand to-ember"
      />
      <h2
        id={titleId}
        className="font-sans text-sm font-bold tracking-[0.18em] text-night/65 uppercase"
      >
        {title}
      </h2>
      <p className="font-display text-4xl leading-tight font-bold text-balance break-words">
        <span aria-hidden="true" className="text-night/30">
          «
        </span>
        {clue}
        <span aria-hidden="true" className="text-night/30">
          »
        </span>
      </p>
    </div>
  );
}
