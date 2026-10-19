import type { RoomMember } from '@family-night/shared';
import { Avatar } from '../../components/Avatar';
import { nameOf } from '../../components/match';

export function TurnOrder({ order, members }: { order: string[]; members: RoomMember[] }) {
  const [first] = order;
  return (
    <section aria-labelledby="turn-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="turn-title" className="text-2xl font-bold">
          Orden de turno
        </h2>
        {first && (
          <p className="text-base text-cream/80">
            Empieza: <strong className="text-moon">{nameOf(members, first)}</strong>
          </p>
        )}
      </div>
      <ol className="flex flex-wrap gap-2">
        {order.map((playerId, index) => {
          const name = nameOf(members, playerId);
          const current = index === 0;
          return (
            <li
              key={playerId}
              aria-current={current ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full py-1 pr-4 pl-1 text-base font-semibold ${
                current ? 'bg-moon text-night shadow-glow' : 'bg-night-soft ring-1 ring-cream/10'
              }`}
            >
              <Avatar
                playerId={playerId}
                name={name}
                className={`size-8 text-xs ${current ? 'bg-night/15! text-night!' : ''}`}
              />
              <span className="font-display tabular-nums opacity-60">{index + 1}</span>
              {name}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
