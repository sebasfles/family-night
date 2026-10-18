import type { RoomResponse } from '@family-night/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/useToast';
import { api } from './client';
import { applyRoom } from './room';

export function useMatchSecret(code: string, matchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['match-secret', matchId],
    queryFn: async () => (await api.matchSecret(code, matchId)).secret,
    staleTime: Infinity,
    enabled,
  });
}

export function useWordCategories() {
  return useQuery({
    queryKey: ['word-categories'],
    queryFn: async () => (await api.wordCategories()).categories,
    staleTime: Infinity,
  });
}

export function useRoomMutation<T = void>(command: (input: T) => Promise<RoomResponse>) {
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
