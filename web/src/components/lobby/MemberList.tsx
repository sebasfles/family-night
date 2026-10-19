import { isOnline, type RoomMember } from '@family-night/shared';
import { Stagger, StaggerItem } from '../../motion/motion';
import { Avatar } from '../Avatar';
import { CrownIcon, PencilIcon } from '../icons';
import { Menu } from '../Menu';

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
      <div className="flex items-center justify-between gap-3">
        <h2 id="members-title" className="text-2xl font-bold">
          Jugadores
        </h2>
        <p className="flex items-center gap-2 rounded-full bg-sage/12 px-3 py-1 text-base font-semibold text-sage">
          <span aria-hidden="true" className="size-2 rounded-full bg-sage" />
          {online} de {members.length} en línea
        </p>
      </div>
      <Stagger className="surface p-2">
        <ul className="flex flex-col gap-1">
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
      </Stagger>
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
    <StaggerItem
      as="li"
      className={`flex min-h-16 items-center gap-3 rounded-2xl py-2 pr-1 pl-2 ${self ? 'bg-cream/5' : ''}`}
    >
      <span className="relative shrink-0">
        <Avatar
          playerId={member.playerId}
          name={member.name}
          dimmed={!online}
          className="size-11 text-base"
        />
        <span
          aria-hidden="true"
          className={`absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-3 ring-night-soft ${online ? 'bg-sage' : 'bg-cream/30'}`}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className={`font-bold break-words ${online ? '' : 'text-cream/50'}`}>
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
      <p className="shrink-0 rounded-full bg-night px-3 py-1 font-display text-lg font-bold text-moon tabular-nums">
        {member.totalScore}{' '}
        <span className="font-sans text-sm font-semibold text-cream/60">pts</span>
      </p>
      {canManage && (
        <Menu
          label={`Opciones para ${member.name}`}
          items={[
            {
              label: 'Hacer host',
              onSelect: () => {
                onMakeHost(member);
              },
            },
            {
              label: 'Sacar de la sala',
              danger: true,
              onSelect: () => {
                onKick(member);
              },
            },
          ]}
        />
      )}
      {self && (
        <button
          type="button"
          aria-label="Cambiar tu nombre"
          onClick={onRename}
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-cream/80 transition-colors hover:bg-cream/8 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
        >
          <PencilIcon className="size-6" />
        </button>
      )}
      {!canManage && !self && <span aria-hidden="true" className="size-12 shrink-0" />}
    </StaggerItem>
  );
}
