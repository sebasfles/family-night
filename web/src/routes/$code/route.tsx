import {
  normalizeRoomCode,
  PING_INTERVAL_MS,
  type GameType,
  type RoomEvent,
} from '@family-night/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { api, isApiError } from '../../api/client';
import { applyRoom, roomKey, useRoom } from '../../api/room';
import { Button } from '../../components/Button';
import { RoomNotFound } from '../../components/RoomNotFound';
import { RoomSessionContext } from '../../components/roomSession';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/useToast';
import { useIdentity } from '../../identity/identity';
import { useRoomChannel } from '../../realtime/useRoomChannel';

const gamePaths = {
  IMPOSTOR: '/$code/impostor',
  WAVELENGTH: '/$code/wavelength',
} as const satisfies Record<GameType, string>;

export const Route = createFileRoute('/$code')({
  beforeLoad: ({ params }) => {
    const code = normalizeRoomCode(params.code);
    if (!code) {
      redirect({ to: '/', replace: true, throw: true });
    } else if (code !== params.code) {
      redirect({ to: '/$code', params: { code }, replace: true, throw: true });
    }
  },
  component: RoomRoute,
});

function RoomRoute() {
  const { code } = Route.useParams();
  const queryClient = useQueryClient();
  const join = useQuery({
    queryKey: ['room-join', code],
    queryFn: async () => {
      const { room } = await api.joinRoom(code);
      applyRoom(queryClient, room);
      return room.version;
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: (failures, error) => isApiError(error, 'NETWORK_ERROR') && failures < 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (join.isPending) {
    return (
      <Screen>
        <p role="status" className="text-cream/80">
          Entrando a la sala {code}…
        </p>
      </Screen>
    );
  }

  if (join.isError) {
    if (isApiError(join.error, 'ROOM_NOT_FOUND')) return <RoomNotFound />;
    return <RoomUnavailable message={join.error.message} retry={() => void join.refetch()} />;
  }

  return <RoomSession code={code} />;
}

function RoomUnavailable({ message, retry }: { message: string; retry: () => void }) {
  const navigate = useNavigate();
  return (
    <Screen>
      <h1 className="text-2xl font-bold text-balance">{message}</h1>
      <div className="flex w-full flex-col gap-3">
        <Button onClick={retry}>Reintentar</Button>
        <Button variant="ghost" onClick={() => void navigate({ to: '/' })}>
          Volver al inicio
        </Button>
      </div>
    </Screen>
  );
}

function RoomSession({ code }: { code: string }) {
  const identity = useIdentity();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const room = useRoom(code);
  const leaving = useRef(false);

  const goHome = useCallback(
    (message?: string) => {
      queryClient.removeQueries({ queryKey: roomKey(code) });
      if (message) toast(message);
      void navigate({ to: '/', replace: true });
    },
    [code, navigate, queryClient, toast],
  );

  const refetchRoom = useCallback(
    () => queryClient.refetchQueries({ queryKey: roomKey(code) }),
    [code, queryClient],
  );

  const kicked = useCallback(() => {
    if (!leaving.current) goHome('Te sacaron de la sala');
  }, [goHome]);

  const ping = useCallback(async () => {
    try {
      applyRoom(queryClient, (await api.ping(code)).room);
      return true;
    } catch (error) {
      if (isApiError(error, 'NOT_MEMBER')) kicked();
      if (isApiError(error, 'ROOM_NOT_FOUND')) void refetchRoom();
      return false;
    }
  }, [code, kicked, queryClient, refetchRoom]);

  const channel = useRoomChannel(code, `${identity.playerId}:${identity.playerToken}`, {
    onEvent: (event: RoomEvent) => {
      if (event.type === 'room.updated' && event.room.roomCode === code) {
        applyRoom(queryClient, event.room);
      } else if (event.type === 'member.kicked' && event.playerId === identity.playerId) {
        kicked();
      } else if (event.type === 'room.closed') {
        void refetchRoom();
      }
    },
    onSubscribed: () => {
      void refetchRoom();
    },
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void ping();
    }, PING_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [ping]);

  useEffect(() => {
    const onVisibility = () => {
      if (leaving.current) return;
      if (document.visibilityState === 'hidden') {
        api.away(code).catch(() => undefined);
        return;
      }
      void ping().then((ok) => {
        if (ok) channel.current?.reconnectNow();
      });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [channel, code, ping]);

  useEffect(() => {
    if (isApiError(room.error, 'NOT_MEMBER')) kicked();
  }, [room.error, kicked]);

  const gameType = room.data?.snapshot.currentMatch?.gameType ?? null;
  const onGame = useLocation({
    select: (location) => {
      const game = Object.entries(gamePaths).find(([, path]) =>
        location.pathname.endsWith(path.slice('/$code'.length)),
      );
      return (game?.[0] as GameType | undefined) ?? null;
    },
  });
  useEffect(() => {
    if (!room.data || gameType === onGame) return;
    void navigate({
      to: gameType ? gamePaths[gameType] : '/$code',
      params: { code },
      replace: true,
    });
  }, [code, gameType, navigate, onGame, room.data]);

  const session = useMemo(
    () => ({
      leave: async () => {
        leaving.current = true;
        try {
          await api.leaveRoom(code);
        } catch (error) {
          if (!isApiError(error, 'NOT_MEMBER')) {
            leaving.current = false;
            throw error;
          }
        }
        goHome();
      },
    }),
    [code, goHome],
  );

  if (isApiError(room.error, 'ROOM_NOT_FOUND')) return <RoomNotFound />;
  if (!room.data) return null;

  return (
    <RoomSessionContext value={session}>
      <Outlet />
    </RoomSessionContext>
  );
}
