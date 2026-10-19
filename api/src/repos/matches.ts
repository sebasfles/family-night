import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { ImpostorPublic, MatchPublic } from '@family-night/shared';
import { epochSeconds } from '../lib/time.ts';
import type { TransactItem } from './db.ts';

export interface MatchItem {
  roomCode: string;
  matchId: string;
  publicState: MatchPublic;
  createdAt: string;
  endedAt: string | null;
  ttl: number;
}

function withDefaults(state: MatchPublic): MatchPublic {
  if (state.gameType !== 'IMPOSTOR') return state;
  const stored: Partial<ImpostorPublic> = state;
  return { ...state, departedIds: stored.departedIds ?? [] };
}

export class MatchesRepo {
  private readonly client: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.client = client;
    this.table = table;
  }

  async get(roomCode: string, matchId: string, nowMs: number): Promise<MatchItem | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { roomCode, matchId }, ConsistentRead: true }),
    );
    const match = Item as MatchItem | undefined;
    if (!match || match.ttl <= epochSeconds(nowMs)) return null;
    return { ...match, publicState: withDefaults(match.publicState) };
  }

  putItem(match: MatchItem): TransactItem {
    const { publicState } = match;
    return {
      Put: {
        TableName: this.table,
        Item: {
          ...match,
          gameType: publicState.gameType,
          status: publicState.status,
          config: publicState.config,
        },
      },
    };
  }

  renewTtlItem(roomCode: string, matchId: string, ttl: number): TransactItem {
    return {
      Update: {
        TableName: this.table,
        Key: { roomCode, matchId },
        UpdateExpression: 'SET #ttl = :ttl',
        ConditionExpression: 'attribute_exists(matchId)',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':ttl': ttl },
      },
    };
  }

  async renewTtl(roomCode: string, matchId: string, ttl: number): Promise<void> {
    const { Update } = this.renewTtlItem(roomCode, matchId, ttl);
    if (Update) await this.client.send(new UpdateCommand(Update));
  }
}
