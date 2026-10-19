import { randomUUID } from 'node:crypto';
import {
  normalizePlayerName,
  playerNameKey,
  type CreatePlayerResponse,
  type MeResponse,
  type RenamePlayerRequest,
  type RenamePlayerResponse,
} from '@family-night/shared';
import type { Deps } from '../deps.ts';
import { hashToken, newPlayerToken, tokenMatches, type Credentials } from '../lib/auth.ts';
import { AppError } from '../lib/errors.ts';
import { iso } from '../lib/time.ts';
import { isWriteConflict, transactWrite } from '../repos/db.ts';
import type { PlayerItem } from '../repos/players.ts';
import { NAME_ATTEMPTS, randomName, suffixedName } from './names.ts';
import {
  replaceMember,
  requireMember,
  resolveHost,
  touchMember,
  updateRoom,
} from './room-state.ts';

const MAX_SUFFIX_ATTEMPTS = 1000;

export async function createPlayer(deps: Deps): Promise<CreatePlayerResponse> {
  const { client, players, playerNames } = deps.repos;
  const playerId = randomUUID();
  const playerToken = newPlayerToken();
  let base = '';

  for (let attempt = 1; attempt <= NAME_ATTEMPTS + MAX_SUFFIX_ATTEMPTS; attempt++) {
    if (attempt <= NAME_ATTEMPTS) base = randomName(deps.random);
    const name = suffixedName(base, attempt);
    const now = iso(deps.clock());
    const player: PlayerItem = {
      playerId,
      name,
      tokenHash: hashToken(playerToken),
      createdAt: now,
      lastSeenAt: now,
    };
    try {
      await transactWrite(client, [
        playerNames.claimItem({ name, playerId, createdAt: now }),
        players.createItem(player),
      ]);
      return { playerId, playerToken, name };
    } catch (error) {
      if (!isWriteConflict(error)) throw error;
    }
  }
  throw new Error('no free player name');
}

export async function authenticate(
  deps: Deps,
  credentials: Credentials | null,
): Promise<PlayerItem> {
  if (!credentials) throw new AppError('UNAUTHORIZED');
  const player = await deps.repos.players.get(credentials.playerId);
  if (!player || !tokenMatches(credentials.playerToken, player.tokenHash)) {
    throw new AppError('UNAUTHORIZED');
  }
  return player;
}

export async function getMe(deps: Deps, player: PlayerItem): Promise<MeResponse> {
  await deps.repos.players.touch(player.playerId, iso(deps.clock()));
  return { playerId: player.playerId, name: player.name };
}

export async function renamePlayer(
  deps: Deps,
  player: PlayerItem,
  request: RenamePlayerRequest,
): Promise<RenamePlayerResponse> {
  const name = normalizePlayerName(request.name);
  if (!name) throw new AppError('INVALID_NAME');
  const { players, playerNames } = deps.repos;
  const room = await updateRoom(deps, request.roomCode, async (state, nowMs) => {
    const caller = requireMember(state, player.playerId);
    const members = replaceMember(state.members, touchMember({ ...caller, name }, nowMs));
    const hostId = resolveHost(state.room.hostId, members, nowMs);
    const current = await players.get(player.playerId);
    if (!current) throw new AppError('UNAUTHORIZED');
    if (current.name === name) return { hostId, members };

    const key = playerNameKey(name);
    const clash = state.members.some(
      (member) => member.playerId !== player.playerId && playerNameKey(member.name) === key,
    );
    const owner = await playerNames.get(name);
    if (clash || (owner && owner.playerId !== player.playerId)) throw new AppError('NAME_TAKEN');
    return {
      hostId,
      members,
      writes: [
        players.renameItem(player.playerId, current.name, name),
        ...(owner
          ? []
          : [playerNames.claimItem({ name, playerId: player.playerId, createdAt: iso(nowMs) })]),
        playerNames.releaseItem(current.name, player.playerId),
      ],
    };
  });
  return { player: { playerId: player.playerId, name }, room };
}
