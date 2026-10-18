import {
  JUST_ONE_MAX_CYCLES,
  MIN_JUST_ONE_PLAYERS,
  MIN_WAVELENGTH_PLAYERS,
  PRESENCE_RECOMPUTE_MS,
  WAVELENGTH_MAX_CYCLES,
  type GameConfigRequest,
  type GameType,
  type RoomMember,
  type RoomSnapshot,
} from '@family-night/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import { useRoomMutation, useRoomView } from '../../api/match';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CyclesPanel } from '../../components/lobby/CyclesPanel';
import { GamePicker } from '../../components/lobby/GamePicker';
import { InviteCard } from '../../components/lobby/InviteCard';
import { MemberList } from '../../components/lobby/MemberList';
import { RenameDialog } from '../../components/lobby/RenameDialog';
import { useRoomSession } from '../../components/roomSession';
import { useToast } from '../../components/useToast';
import { useNow } from '../../components/useNow';
import { LobbyPanel as ImpostorPanel } from '../../games/impostor/LobbyPanel';
import { useIdentity } from '../../identity/identity';
import { saveIdentity, type Identity } from '../../identity/storage';

export const Route = createFileRoute('/$code/')({
  component: Lobby,
});

interface PanelProps {
  code: string;
  snapshot: RoomSnapshot;
  isHost: boolean;
  nowMs: number;
}

const panels: Record<GameType, (props: PanelProps) => ReactNode> = {
  IMPOSTOR: ImpostorPanel,
  WAVELENGTH: (props) => (
    <CyclesPanel
      {...props}
      gameType="WAVELENGTH"
      minPlayers={MIN_WAVELENGTH_PLAYERS}
      maxCycles={WAVELENGTH_MAX_CYCLES}
      turn="es psíquico"
    />
  ),
  JUST_ONE: (props) => (
    <CyclesPanel
      {...props}
      gameType="JUST_ONE"
      minPlayers={MIN_JUST_ONE_PLAYERS}
      maxCycles={JUST_ONE_MAX_CYCLES}
      turn="adivina"
    />
  ),
};

function Lobby() {
  const { code } = Route.useParams();
  const identity = useIdentity();
  const session = useRoomSession();
  const toast = useToast();
  const now = useNow(PRESENCE_RECOMPUTE_MS);
  const queryClient = useQueryClient();
  const room = useRoomView(code);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const makeHost = useRoomMutation(
    code,
    (member: RoomMember) => api.makeHost(code, { playerId: member.playerId }),
    (member) => ({ kind: 'host', playerId: member.playerId }),
  );
  const kick = useRoomMutation(
    code,
    (member: RoomMember) => api.kick(code, { playerId: member.playerId }),
    (member) => ({ kind: 'kick', playerId: member.playerId }),
  );
  const pick = useRoomMutation(
    code,
    (request: GameConfigRequest) => api.updateConfig(code, request),
    (request) => ({ kind: 'config', request }),
  );
  const rename = useRoomMutation(
    code,
    async (name: string) => {
      const response = await api.rename({ name, roomCode: code });
      const renamed: Identity = { ...identity, name: response.player.name };
      saveIdentity(renamed);
      queryClient.setQueryData(['identity'], renamed);
      return response;
    },
    (name) => ({ kind: 'rename', playerId: identity.playerId, name }),
  );
  const leave = useMutation({
    mutationFn: session.leave,
    onError: (error) => {
      toast(error.message);
    },
  });

  if (!room) return null;
  const { snapshot, clockOffsetMs } = room;
  const isHost = snapshot.hostId === identity.playerId;
  const Panel = panels[snapshot.selectedGame];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 py-8 md:max-w-2xl">
      <InviteCard code={code} />

      <MemberList
        members={snapshot.members}
        hostId={snapshot.hostId}
        selfId={identity.playerId}
        nowMs={now + clockOffsetMs}
        onMakeHost={(member) => {
          makeHost.mutate(member);
        }}
        onKick={(member) => {
          kick.mutate(member);
        }}
        onRename={() => {
          setRenaming(true);
        }}
      />

      <GamePicker
        selected={snapshot.selectedGame}
        editable={isHost}
        onSelect={(game: GameType) => {
          pick.mutate({ gameType: game, config: snapshot.configs[game] } as GameConfigRequest);
        }}
      />

      <Panel code={code} snapshot={snapshot} isHost={isHost} nowMs={now + clockOffsetMs} />

      <Button
        variant="ghost"
        className="self-center"
        onClick={() => {
          setConfirmLeave(true);
        }}
      >
        Salir de la sala
      </Button>

      {renaming && (
        <RenameDialog
          current={snapshot.members.find((m) => m.playerId === identity.playerId)?.name ?? ''}
          others={snapshot.members.filter((m) => m.playerId !== identity.playerId)}
          onRename={(name) => {
            setRenaming(false);
            rename.mutate(name);
          }}
          onCancel={() => {
            setRenaming(false);
          }}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="¿Salir de la sala?"
          confirmLabel="Sí, salir"
          busy={leave.isPending}
          onConfirm={() => {
            leave.mutate();
          }}
          onCancel={() => {
            setConfirmLeave(false);
          }}
        />
      )}
    </main>
  );
}
