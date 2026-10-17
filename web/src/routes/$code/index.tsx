import { PRESENCE_RECOMPUTE_MS, type RoomMember, type RoomResponse } from '@family-night/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../../api/client';
import { applyRoom, useRoom } from '../../api/room';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GamePicker } from '../../components/lobby/GamePicker';
import { InviteCard } from '../../components/lobby/InviteCard';
import { MemberList } from '../../components/lobby/MemberList';
import { useRoomSession } from '../../components/roomSession';
import { useToast } from '../../components/useToast';
import { useNow } from '../../components/useNow';
import { useIdentity } from '../../identity/identity';

export const Route = createFileRoute('/$code/')({
  component: Lobby,
});

function useRoomCommand(command: (member: RoomMember) => Promise<RoomResponse>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: command,
    onSuccess: ({ room }) => {
      applyRoom(queryClient, room);
    },
    onError: (error) => {
      toast(error.message);
    },
  });
}

function Lobby() {
  const { code } = Route.useParams();
  const identity = useIdentity();
  const session = useRoomSession();
  const toast = useToast();
  const now = useNow(PRESENCE_RECOMPUTE_MS);
  const room = useRoom(code).data;
  const [confirmLeave, setConfirmLeave] = useState(false);

  const makeHost = useRoomCommand((member) => api.makeHost(code, { playerId: member.playerId }));
  const kick = useRoomCommand((member) => api.kick(code, { playerId: member.playerId }));
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

      <GamePicker />

      <p className="text-center text-base text-cream/70">
        {isHost ? 'Eres el host: tú eliges el juego.' : 'El host elegirá el juego.'}
      </p>

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
