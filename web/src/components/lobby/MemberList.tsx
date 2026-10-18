import { isOnline, type RoomMember } from '@family-night/shared';
import { useEffect, useRef, useState } from 'react';
import { CrownIcon, MoreIcon, PencilIcon } from '../icons';

interface MemberListProps {
  members: RoomMember[];
  hostId: string;
  selfId: string;
  nowMs: number;
  onMakeHost: (member: RoomMember) => void;
  onKick: (member: RoomMember) => void;
  onRename: () => void;
}

export function MemberList({
  members,
  hostId,
  selfId,
  nowMs,
  onMakeHost,
  onKick,
  onRename,
}: MemberListProps) {
  const isHost = hostId === selfId;
  const online = members.filter((member) => isOnline(member.lastSeenAt, nowMs)).length;

  return (
    <section aria-labelledby="members-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="members-title" className="text-xl font-bold">
          Jugadores
        </h2>
        <p className="text-base text-cream/70">
          {online} de {members.length} en línea
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-cream/10 rounded-3xl bg-night-soft ring-1 ring-cream/10">
        {members.map((member) => (
          <MemberRow
            key={member.playerId}
            member={member}
            online={isOnline(member.lastSeenAt, nowMs)}
            host={member.playerId === hostId}
            self={member.playerId === selfId}
            canManage={isHost && member.playerId !== selfId}
            onMakeHost={onMakeHost}
            onKick={onKick}
            onRename={onRename}
          />
        ))}
      </ul>
    </section>
  );
}

interface MemberRowProps {
  member: RoomMember;
  online: boolean;
  host: boolean;
  self: boolean;
  canManage: boolean;
  onMakeHost: (member: RoomMember) => void;
  onKick: (member: RoomMember) => void;
  onRename: () => void;
}

function MemberRow({
  member,
  online,
  host,
  self,
  canManage,
  onMakeHost,
  onKick,
  onRename,
}: MemberRowProps) {
  const cut = member.name.lastIndexOf(' ') + 1;
  const leading = member.name.slice(0, cut);
  const last = member.name.slice(cut);
  return (
    <li className="flex min-h-16 items-center gap-3 px-4 py-2">
      <span
        aria-hidden="true"
        className={`size-3 shrink-0 rounded-full ${online ? 'bg-emerald-400' : 'bg-cream/30'}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className={`font-semibold break-words ${online ? '' : 'text-cream/50'}`}>
          {leading}
          <span className="whitespace-nowrap">
            {last}
            {self && <span className="ml-2 font-normal text-cream/60">(tú)</span>}
            {host && (
              <span className="ml-2 inline-block align-[-0.2em] text-moon" title="Host">
                <CrownIcon className="size-5" />
                <span className="sr-only">host</span>
              </span>
            )}
          </span>
        </p>
        <p className="text-sm text-cream/60">{online ? 'en línea' : 'ausente'}</p>
      </div>
      <p className="shrink-0 text-base font-semibold text-cream/80 tabular-nums">
        {member.totalScore} <span className="text-sm font-normal text-cream/60">pts</span>
      </p>
      {canManage && <MemberMenu member={member} onMakeHost={onMakeHost} onKick={onKick} />}
      {self && (
        <button
          type="button"
          aria-label="Cambiar tu nombre"
          onClick={onRename}
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-cream/80 hover:bg-cream/10 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
        >
          <PencilIcon className="size-6" />
        </button>
      )}
      {!canManage && !self && <span aria-hidden="true" className="size-12 shrink-0" />}
    </li>
  );
}

interface MemberMenuProps {
  member: RoomMember;
  onMakeHost: (member: RoomMember) => void;
  onKick: (member: RoomMember) => void;
}

function MemberMenu({ member, onMakeHost, onKick }: MemberMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const choose = (action: (member: RoomMember) => void) => {
    setOpen(false);
    action(member);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Opciones para ${member.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="flex size-12 items-center justify-center rounded-full text-cream/80 hover:bg-cream/10 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
      >
        <MoreIcon className="size-6" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 flex w-52 flex-col overflow-hidden rounded-2xl bg-cream text-night shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              choose(onMakeHost);
            }}
            className="min-h-12 px-4 text-left font-semibold hover:bg-night/10"
          >
            Hacer host
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              choose(onKick);
            }}
            className="min-h-12 px-4 text-left font-semibold text-red-700 hover:bg-night/10"
          >
            Sacar de la sala
          </button>
        </div>
      )}
    </div>
  );
}
