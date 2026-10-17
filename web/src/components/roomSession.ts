import { createContext, use } from 'react';

export interface RoomSession {
  leave: () => Promise<void>;
}

export const RoomSessionContext = createContext<RoomSession | null>(null);

export function useRoomSession(): RoomSession {
  const session = use(RoomSessionContext);
  if (!session) throw new Error('useRoomSession must be used inside the $code route');
  return session;
}
