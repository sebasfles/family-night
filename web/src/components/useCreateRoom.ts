import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '../api/client';
import { applyRoom } from '../api/room';
import { useToast } from './useToast';

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  return useMutation({
    mutationFn: api.createRoom,
    onSuccess: ({ room }) => {
      applyRoom(queryClient, room);
      void navigate({ to: '/$code', params: { code: room.roomCode } });
    },
    onError: (error) => {
      toast(error.message);
    },
  });
}
