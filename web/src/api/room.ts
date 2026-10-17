import type { RoomSnapshot } from '@family-night/shared';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface CachedRoom {
  snapshot: RoomSnapshot;
  clockOffsetMs: number;
}

export const roomKey = (code: string) => ['room', code] as const;

export function toCachedRoom(snapshot: RoomSnapshot): CachedRoom {
  return { snapshot, clockOffsetMs: Date.parse(snapshot.serverTime) - Date.now() };
}

export function newer(cached: CachedRoom | undefined, snapshot: RoomSnapshot): CachedRoom {
  if (!cached) return toCachedRoom(snapshot);
  const { version, serverTime } = cached.snapshot;
  const stale =
    snapshot.version < version ||
    (snapshot.version === version && Date.parse(snapshot.serverTime) <= Date.parse(serverTime));
  return stale ? cached : toCachedRoom(snapshot);
}

export function applyRoom(queryClient: QueryClient, snapshot: RoomSnapshot): void {
  queryClient.setQueryData<CachedRoom>(roomKey(snapshot.roomCode), (cached) =>
    newer(cached, snapshot),
  );
}

export function useRoom(code: string) {
  return useQuery({
    queryKey: roomKey(code),
    queryFn: async ({ client }) => {
      const { room } = await api.getRoom(code);
      return newer(client.getQueryData<CachedRoom>(roomKey(code)), room);
    },
    staleTime: Infinity,
    retry: false,
  });
}
