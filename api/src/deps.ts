import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Clock } from './lib/time.ts';
import { createAppSyncPublisher, skipPublish, type Publisher } from './realtime/publish.ts';
import { createDocumentClient, requireEnv, type TableNames } from './repos/db.ts';
import { PlayerNamesRepo } from './repos/player-names.ts';
import { PlayersRepo } from './repos/players.ts';
import { RoomMembersRepo } from './repos/room-members.ts';
import { RoomsRepo } from './repos/rooms.ts';

export interface Repos {
  client: DynamoDBDocumentClient;
  players: PlayersRepo;
  playerNames: PlayerNamesRepo;
  rooms: RoomsRepo;
  roomMembers: RoomMembersRepo;
}

export interface Deps {
  repos: Repos;
  publish: Publisher;
  clock: Clock;
  random: () => number;
}

export function createRepos(client: DynamoDBDocumentClient, tables: TableNames): Repos {
  return {
    client,
    players: new PlayersRepo(client, tables.players),
    playerNames: new PlayerNamesRepo(tables.playerNames),
    rooms: new RoomsRepo(client, tables.rooms),
    roomMembers: new RoomMembersRepo(client, tables.roomMembers),
  };
}

export function depsFromEnv(): Deps {
  const tables: TableNames = {
    players: requireEnv('PLAYERS_TABLE'),
    playerNames: requireEnv('PLAYER_NAMES_TABLE'),
    rooms: requireEnv('ROOMS_TABLE'),
    roomMembers: requireEnv('ROOM_MEMBERS_TABLE'),
  };
  const eventsDomain = process.env.EVENTS_HTTP_DOMAIN;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return {
    repos: createRepos(createDocumentClient(), tables),
    publish: eventsDomain ? createAppSyncPublisher(eventsDomain, region) : skipPublish,
    clock: Date.now,
    random: Math.random,
  };
}
