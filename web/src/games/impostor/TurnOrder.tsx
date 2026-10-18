import type { RoomMember } from '@family-night/shared';
import { nameOf } from './model';

export function TurnOrder({ order, members }: { order: string[]; members: RoomMember[] }) {
  const [first] = order;
  return (
    <section aria-labelledby="turn-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="turn-title" className="text-xl font-bold">
          Orden de turno
        </h2>
        {first && (
          <p className="text-base text-cream/80">
            Empieza: <strong className="text-moon">{nameOf(members, first)}</strong>
          </p>
        )}
      </div>
      <ol className="flex flex-wrap gap-2">
        {order.map((playerId, index) => (
          <li
            key={playerId}
            aria-current={index === 0 ? 'step' : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-base font-semibold ${
              index === 0 ? 'bg-moon text-night' : 'bg-night-soft ring-1 ring-cream/10'
            }`}
          >
            <span className="tabular-nums opacity-70">{index + 1}</span>
            {nameOf(members, playerId)}
          </li>
        ))}
      </ol>
    </section>
  );
}
