import type { RoomMember } from '@family-night/shared';
import { Avatar } from '../../components/Avatar';
import { CowIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
import { Pop, SlideIn } from '../../motion/motion';

interface CowCardProps {
  holderId: string | null;
  previousId: string | null;
  members: RoomMember[];
  selfId: string;
}

export function CowCard({ holderId, previousId, members, selfId }: CowCardProps) {
  const moved = holderId !== null && holderId !== previousId;
  const holder = holderId === null ? null : nameOf(members, holderId);
  const title =
    holderId === null
      ? 'Nadie tiene la vaca rosa'
      : holderId === selfId
        ? moved
          ? '¡Te llevas la vaca rosa!'
          : 'Sigues con la vaca rosa'
        : moved
          ? `La vaca rosa pasa a ${holder ?? ''}`
          : `${holder ?? ''} sigue con la vaca rosa`;

  return (
    <section
      aria-label="La vaca rosa"
      className="flex items-center gap-4 rounded-3xl bg-rose/10 p-4 ring-1 ring-rose/35"
    >
      <div className="flex shrink-0 items-center">
        {holderId === null ? (
          <span className="flex size-12 items-center justify-center rounded-full bg-rose/14 text-rose">
            <CowIcon className="size-8" />
          </span>
        ) : (
          <>
            <Pop>
              <Avatar playerId={holderId} name={holder ?? ''} className="size-12 text-base" />
            </Pop>
            <SlideIn key={holderId} from={moved ? -1 : 1} className="-ml-2">
              <span className="flex size-10 items-center justify-center rounded-full bg-rose text-night shadow-lift ring-2 ring-night">
                <CowIcon className="size-7" />
              </span>
            </SlideIn>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p role="status" className="text-lg leading-snug font-bold text-balance break-words">
          {title}
        </p>
        {moved && previousId !== null && (
          <p className="text-base text-cream/75">Se la quitó a {nameOf(members, previousId)}</p>
        )}
        <p className="text-base text-cream/70">Quien la tiene no puede ganar.</p>
      </div>
    </section>
  );
}
