import { EVENTS_NAMESPACE, isRoomCode } from '@family-night/shared';
import { parseCredentials, tokenMatches } from './lib/auth.ts';
import { describeError, log } from './lib/log.ts';
import type { Clock } from './lib/time.ts';
import { createDocumentClient, requireEnv } from './repos/db.ts';
import { PlayersRepo } from './repos/players.ts';
import { RoomMembersRepo } from './repos/room-members.ts';

export const ALLOW_TTL_SECONDS = 300;

export interface EventsAuthRequest {
  authorizationToken?: string | null;
  requestContext?: {
    operation?: string | null;
    channelNamespaceName?: string | null;
    channel?: string | null;
  } | null;
}

export interface EventsAuthResult {
  isAuthorized: boolean;
  ttlOverride: number;
}

export interface EventsAuthDeps {
  players: PlayersRepo;
  roomMembers: RoomMembersRepo;
  clock: Clock;
}

const allow: EventsAuthResult = { isAuthorized: true, ttlOverride: ALLOW_TTL_SECONDS };
const deny: EventsAuthResult = { isAuthorized: false, ttlOverride: 0 };

function splitToken(token: string | null | undefined) {
  const separator = token?.indexOf(':') ?? -1;
  if (!token || separator < 0) return null;
  return parseCredentials(token.slice(0, separator), token.slice(separator + 1));
}

function roomCodeOf(channel: string | null | undefined): string | null {
  const match = /^\/([^/]+)\/([^/]+)$/.exec(channel ?? '');
  if (match?.[1] !== EVENTS_NAMESPACE || !match[2] || !isRoomCode(match[2])) return null;
  return match[2];
}

export function createAuthorizer(deps: EventsAuthDeps) {
  return async (request: EventsAuthRequest): Promise<EventsAuthResult> => {
    const operation = request.requestContext?.operation ?? null;
    const channel = request.requestContext?.channel ?? null;
    const credentials = splitToken(request.authorizationToken);
    const decide = async (): Promise<EventsAuthResult> => {
      if (!credentials) return deny;
      const player = await deps.players.get(credentials.playerId);
      if (!player || !tokenMatches(credentials.playerToken, player.tokenHash)) return deny;
      if (operation === 'EVENT_CONNECT') return allow;
      if (operation !== 'EVENT_SUBSCRIBE') return deny;
      const roomCode = roomCodeOf(channel);
      if (!roomCode) return deny;
      const member = await deps.roomMembers.get(roomCode, player.playerId, deps.clock());
      return member ? allow : deny;
    };

    let result = deny;
    try {
      result = await decide();
    } catch (error) {
      log.error('events auth failed', { operation, channel, ...describeError(error) });
    }
    log.info('events auth', {
      playerId: credentials?.playerId ?? null,
      operation,
      channel,
      decision: result.isAuthorized ? 'allow' : 'deny',
    });
    return result;
  };
}

let defaultAuthorizer: ReturnType<typeof createAuthorizer> | undefined;

export const handler = (request: EventsAuthRequest): Promise<EventsAuthResult> => {
  defaultAuthorizer ??= (() => {
    const client = createDocumentClient();
    return createAuthorizer({
      players: new PlayersRepo(client, requireEnv('PLAYERS_TABLE')),
      roomMembers: new RoomMembersRepo(client, requireEnv('ROOM_MEMBERS_TABLE')),
      clock: Date.now,
    });
  })();
  return defaultAuthorizer(request);
};
