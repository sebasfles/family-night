import { CowIcon, CrownIcon } from '../../components/icons';
import { pointsLabel } from './model';

interface WinnerBannerProps {
  titleId?: string;
  winners: string[];
  points: number;
}

export function WinnerBanner({ titleId, winners, points }: WinnerBannerProps) {
  const title =
    winners.length === 0 || points === 0
      ? 'Nadie sumó puntos'
      : winners.length === 1
        ? `Ganó ${winners.join('')}`
        : `Empate: ${winners.join(', ')}`;
  return (
    <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-card bg-linear-to-b from-rose to-rose-deep px-6 py-7 text-center text-night shadow-lift">
      <CowIcon className="pointer-events-none absolute -right-5 -bottom-6 size-32 rotate-12 text-night/10" />
      <span className="flex size-16 items-center justify-center rounded-full bg-night/10">
        <CrownIcon className="size-9" />
      </span>
      <h2 id={titleId} className="text-4xl font-bold text-balance break-words">
        {title}
      </h2>
      {points > 0 && <p className="text-xl font-bold">con {pointsLabel(points)}</p>}
    </div>
  );
}
