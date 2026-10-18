import {
  PRESENCE_RECOMPUTE_MS,
  type GameConfigRequest,
  type GameType,
  type RoomMember,
} from '@family-night/shared';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../../api/client';
import { useRoomMutation } from '../../api/match';
import { useRoom } from '../../api/room';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GamePicker } from '../../components/lobby/GamePicker';
import { InviteCard } from '../../components/lobby/InviteCard';
import { MemberList } from '../../components/lobby/MemberList';
import { useRoomSession } from '../../components/roomSession';
import { useToast } from '../../components/useToast';
import { useNow } from '../../components/useNow';
import { LobbyPanel as ImpostorPanel } from '../../games/impostor/LobbyPanel';
import { LobbyPanel as WavelengthPanel } from '../../games/wavelength/LobbyPanel';
import { useIdentity } from '../../identity/identity';

export const Route = createFileRoute('/$code/')({
  component: Lobby,
});

function Lobby() {
  const { code } = Route.useParams();
  const identity = useIdentity();
  const session = useRoomSession();
  const toast = useToast();
  const now = useNow(PRESENCE_RECOMPUTE_MS);
  const room = useRoom(code).data;
  const [confirmLeave, setConfirmLeave] = useState(false);

  const makeHost = useRoomMutation((member: RoomMember) =>
    api.makeHost(code, { playerId: member.playerId }),
  );
  const kick = useRoomMutation((member: RoomMember) =>
    api.kick(code, { playerId: member.playerId }),
  );
  const pick = useRoomMutation((game: GameType) => {
    const configs = room?.snapshot.configs;
    if (!configs) throw new Error('no room');
    return api.updateConfig(code, { gameType: game, config: configs[game] } as GameConfigRequest);
  });
  const leave = useMutation({
    mutationFn: session.leave,
    onError: (error) => {
      toast(error.message);
    },
  });

  if (!room) return null;
  const { snapshot, clockOffsetMs } = room;
  const isHost = snapshot.hostId === identity.playerId;

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
      />

      <GamePicker
        selected={snapshot.selectedGame}
        editable={isHost}
        busy={pick.isPending}
        onSelect={(game) => {
          pick.mutate(game);
        }}
      />

      {snapshot.selectedGame === 'WAVELENGTH' ? (
        <WavelengthPanel
          code={code}
          snapshot={snapshot}
          isHost={isHost}
          nowMs={now + clockOffsetMs}
        />
      ) : (
        <ImpostorPanel
          code={code}
          snapshot={snapshot}
          isHost={isHost}
          nowMs={now + clockOffsetMs}
        />
      )}

      <Button
        variant="ghost"
        className="self-center"
        onClick={() => {
          setConfirmLeave(true);
        }}
      >
        Salir de la sala
      </Button>

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
