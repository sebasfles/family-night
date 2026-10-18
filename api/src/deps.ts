import { randomInt } from 'node:crypto';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { RandomInt } from '@family-night/shared';
import type { Clock } from './lib/time.ts';
import { createAppSyncPublisher, skipPublish, type Publisher } from './realtime/publish.ts';
import { createDocumentClient, requireEnv, type TableNames } from './repos/db.ts';
import { MatchSecretsRepo } from './repos/match-secrets.ts';
import { MatchesRepo } from './repos/matches.ts';
import { PlayerNamesRepo } from './repos/player-names.ts';
import { PlayersRepo } from './repos/players.ts';
import { RoomMembersRepo } from './repos/room-members.ts';
import { RoomsRepo } from './repos/rooms.ts';
import { VotesRepo } from './repos/votes.ts';

export interface Repos {
  client: DynamoDBDocumentClient;
  players: PlayersRepo;
  playerNames: PlayerNamesRepo;
  rooms: RoomsRepo;
  roomMembers: RoomMembersRepo;
  matches: MatchesRepo;
  matchSecrets: MatchSecretsRepo;
  votes: VotesRepo;
}

export interface Deps {
  repos: Repos;
  publish: Publisher;
  clock: Clock;
  random: () => number;
  secureRandomInt: RandomInt;
}

export const cryptoRandomInt: RandomInt = (maxExclusive) => randomInt(maxExclusive);

export function createRepos(client: DynamoDBDocumentClient, tables: TableNames): Repos {
  return {
    client,
    players: new PlayersRepo(client, tables.players),
    playerNames: new PlayerNamesRepo(tables.playerNames),
    rooms: new RoomsRepo(client, tables.rooms),
    roomMembers: new RoomMembersRepo(client, tables.roomMembers),
    matches: new MatchesRepo(client, tables.matches),
    matchSecrets: new MatchSecretsRepo(client, tables.matchSecrets),
    votes: new VotesRepo(client, tables.votes),
  };
}

export function depsFromEnv(): Deps {
  const tables: TableNames = {
    players: requireEnv('PLAYERS_TABLE'),
    playerNames: requireEnv('PLAYER_NAMES_TABLE'),
    rooms: requireEnv('ROOMS_TABLE'),
    roomMembers: requireEnv('ROOM_MEMBERS_TABLE'),
    matches: requireEnv('MATCHES_TABLE'),
    matchSecrets: requireEnv('MATCH_SECRETS_TABLE'),
    votes: requireEnv('VOTES_TABLE'),
  };
  const eventsDomain = process.env.EVENTS_HTTP_DOMAIN;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return {
    repos: createRepos(createDocumentClient(), tables),
    publish: eventsDomain ? createAppSyncPublisher(eventsDomain, region) : skipPublish,
    clock: Date.now,
    random: Math.random,
    secureRandomInt: cryptoRandomInt,
  };
}
