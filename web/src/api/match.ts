import type { RoomResponse } from '@family-night/shared';
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useToast } from '../components/useToast';
import { api } from './client';
import { applyOptimistic, type Optimistic } from './optimistic';
import { applyRoom, useRoom, type CachedRoom } from './room';

export function useMatchSecret(
  code: string,
  matchId: string,
  round: number | null,
  enabled: boolean,
  phase: string | null = null,
) {
  return useQuery({
    queryKey: ['match-secret', matchId, round, phase],
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

interface RoomCommand<T> {
  input: T;
  optimistic: Optimistic | null;
}

const roomCommandKey = (code: string) => ['room-command', code] as const;

export function useRoomMutation<T = void>(
  code: string,
  command: (input: T) => Promise<RoomResponse>,
  optimistic?: (input: T) => Optimistic | null,
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationKey: roomCommandKey(code),
    scope: { id: `room-command:${code}` },
    mutationFn: ({ input }: RoomCommand<T>) => command(input),
    onSuccess: ({ room }) => {
      applyRoom(queryClient, room);
    },
    onError: (error) => {
      toast(error.message);
    },
  });
  const commandOf = (input: T): RoomCommand<T> => ({
    input,
    optimistic: optimistic?.(input) ?? null,
  });
  return {
    isPending: mutation.isPending,
    variables: mutation.isPending ? mutation.variables.input : undefined,
    mutate: (input: T) => {
      mutation.mutate(commandOf(input));
    },
  };
}

export function useRoomView(code: string): CachedRoom | undefined {
  const room = useRoom(code).data;
  const pending = useMutationState({
    filters: { mutationKey: roomCommandKey(code), status: 'pending' },
    select: (mutation) =>
      (mutation.state.variables as RoomCommand<unknown> | undefined)?.optimistic ?? null,
  });
  return useMemo(() => {
    if (!room) return undefined;
    const steps = pending.filter((step) => step !== null);
    if (steps.length === 0) return room;
    return { ...room, snapshot: steps.reduce(applyOptimistic, room.snapshot) };
  }, [room, pending]);
}
