import type { ManadaGroup, RoomMember } from '@family-night/shared';
import { nameOf } from '../../components/match';

export type GroupVerdict = 'SCORES' | 'TIED' | null;

interface GroupCardProps {
  group: ManadaGroup;
  members: RoomMember[];
  verdict: GroupVerdict;
  selected?: boolean;
  onSelect?: () => void;
  onSplit?: () => void;
}

const stamps = {
  SCORES: { text: '+1 cada uno', tone: 'bg-sage text-night' },
  TIED: { text: 'Empate', tone: 'bg-sand text-night' },
} as const;

export function GroupCard({
  group,
  members,
  verdict,
  selected = false,
  onSelect,
  onSplit,
}: GroupCardProps) {
  const label = group.labels.join(' / ');
  const stamp = verdict ? stamps[verdict] : null;
  return (
    <div
      className={`relative flex h-full flex-col gap-3 rounded-2xl px-4 pt-4 pb-3 transition-[box-shadow,transform] duration-150 ${
        verdict === 'SCORES' ? 'card-paper ring-4 ring-sage/70' : 'card-paper'
      } ${selected ? 'outline-4 outline-offset-2 outline-moon' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-display text-2xl leading-tight font-bold break-words">{label}</p>
        <span className="mt-1 shrink-0 rounded-full bg-night/8 px-2.5 py-0.5 text-sm font-bold text-night/75 tabular-nums">
          {group.playerIds.length}
        </span>
      </div>
      <ul aria-label={`Respondieron ${label}`} className="flex flex-wrap gap-1.5">
        {group.playerIds.map((playerId) => (
          <li
            key={playerId}
            className="rounded-full bg-night/8 px-3 py-1 text-base font-semibold text-night/85"
          >
            {nameOf(members, playerId)}
          </li>
        ))}
      </ul>
      {(stamp ?? group.merged) && (
        <div className="flex flex-wrap items-center gap-2">
          {stamp && (
            <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${stamp.tone}`}>
              {stamp.text}
            </span>
          )}
          {group.merged && (
            <span className="rounded-full bg-night/8 px-3 py-0.5 text-sm font-bold text-night/75">
              Unidas por el host
            </span>
          )}
        </div>
      )}
      {onSelect && (
        <button
          type="button"
          aria-label={`${selected ? 'Soltar' : 'Elegir'} el grupo ${label}`}
          aria-pressed={selected}
          onClick={onSelect}
          className="absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
        />
      )}
      {onSplit && group.merged && (
        <button
          type="button"
          onClick={onSplit}
          className="relative z-10 -mb-1 inline-flex min-h-12 items-center self-start rounded-full px-3 text-base font-bold text-night underline decoration-night/40 underline-offset-4 hover:bg-night/8 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
        >
          Separar
        </button>
      )}
    </div>
  );
}
