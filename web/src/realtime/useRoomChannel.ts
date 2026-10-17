import { roomChannel, type RoomEvent } from '@family-night/shared';
import { useEffect, useRef } from 'react';
import { RoomChannel, realtimeConfigFromEnv } from './client';

interface Handlers {
  onEvent: (event: RoomEvent) => void;
  onSubscribed: () => void;
}

export function useRoomChannel(code: string, token: string, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  const channelRef = useRef<RoomChannel | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const config = realtimeConfigFromEnv();
    if (!config) return;
    const channel = new RoomChannel({
      config,
      token,
      channel: roomChannel(code),
      onEvent: (event) => {
        handlersRef.current.onEvent(event);
      },
      onSubscribed: () => {
        handlersRef.current.onSubscribed();
      },
    });
    channelRef.current = channel;
    channel.start();
    return () => {
      channel.stop();
      channelRef.current = null;
    };
  }, [code, token]);

  return channelRef;
}
