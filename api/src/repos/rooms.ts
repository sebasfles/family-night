import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { GameConfigs, GameType } from '@family-night/shared';
import { epochSeconds } from '../lib/time.ts';
import type { TransactItem } from './db.ts';

export interface RoomItem {
  roomCode: string;
  hostId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  ttl: number;
  currentMatchId: string | null;
  usedWordIds: string[];
  usedSpectrumIds: string[];
  usedJustOneWordIds: string[];
  selectedGame: GameType;
  configs: Partial<GameConfigs>;
}

export interface RoomBump {
  roomCode: string;
  expectedVersion: number;
  hostId: string;
  currentMatchId: string | null;
  usedWordIds: string[];
  usedSpectrumIds: string[];
  usedJustOneWordIds: string[];
  selectedGame: GameType;
  configs: Partial<GameConfigs>;
  updatedAt: string;
  ttl: number;
}

export class RoomsRepo {
  private readonly client: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.client = client;
    this.table = table;
  }

  async get(roomCode: string, nowMs: number): Promise<RoomItem | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { roomCode }, ConsistentRead: true }),
    );
    const room = Item as Partial<RoomItem> | undefined;
    if (!room || (room.ttl ?? 0) <= epochSeconds(nowMs)) return null;
    return {
      ...(room as RoomItem),
      currentMatchId: room.currentMatchId ?? null,
      usedWordIds: room.usedWordIds ?? [],
      usedSpectrumIds: room.usedSpectrumIds ?? [],
      usedJustOneWordIds: room.usedJustOneWordIds ?? [],
      selectedGame: room.selectedGame ?? 'IMPOSTOR',
      configs: room.configs ?? {},
    };
  }

  createItem(room: RoomItem, nowMs: number): TransactItem {
    return {
      Put: {
        TableName: this.table,
        Item: room,
        ConditionExpression: 'attribute_not_exists(roomCode) OR #ttl <= :now',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':now': epochSeconds(nowMs) },
      },
    };
  }

  bumpItem(bump: RoomBump): TransactItem {
    return {
      Update: {
        TableName: this.table,
        Key: { roomCode: bump.roomCode },
        UpdateExpression:
          'SET version = :next, hostId = :hostId, currentMatchId = :currentMatchId, ' +
          'usedWordIds = :usedWordIds, usedSpectrumIds = :usedSpectrumIds, ' +
          'usedJustOneWordIds = :usedJustOneWordIds, ' +
          'selectedGame = :selectedGame, configs = :configs, updatedAt = :updatedAt, #ttl = :ttl',
        ConditionExpression: 'version = :expected',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':expected': bump.expectedVersion,
          ':next': bump.expectedVersion + 1,
          ':hostId': bump.hostId,
          ':currentMatchId': bump.currentMatchId,
          ':usedWordIds': bump.usedWordIds,
          ':usedSpectrumIds': bump.usedSpectrumIds,
          ':usedJustOneWordIds': bump.usedJustOneWordIds,
          ':selectedGame': bump.selectedGame,
          ':configs': bump.configs,
          ':updatedAt': bump.updatedAt,
          ':ttl': bump.ttl,
        },
      },
    };
  }

  async renewTtl(roomCode: string, ttl: number): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { roomCode },
        UpdateExpression: 'SET #ttl = :ttl',
        ConditionExpression: 'attribute_exists(roomCode)',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':ttl': ttl },
      }),
    );
  }
}
