import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { ImpostorSecret } from '@family-night/shared';
import { epochSeconds } from '../lib/time.ts';
import type { TransactItem } from './db.ts';

export const MATCH_KEY = '#MATCH';

export interface PlayerSecretItem {
  matchId: string;
  playerId: string;
  secret: ImpostorSecret;
  ttl: number;
}

export interface MatchSecretItem {
  matchId: string;
  playerId: typeof MATCH_KEY;
  wordId: string;
  word: string;
  category: string;
  clue: string;
  options: string[];
  impostorIds: string[];
  ttl: number;
}

export class MatchSecretsRepo {
  private readonly client: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.client = client;
    this.table = table;
  }

  private async read<T extends { ttl: number }>(
    matchId: string,
    playerId: string,
    nowMs: number,
  ): Promise<T | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { matchId, playerId }, ConsistentRead: true }),
    );
    const item = Item as T | undefined;
    return item && item.ttl > epochSeconds(nowMs) ? item : null;
  }

  getPlayer(matchId: string, playerId: string, nowMs: number): Promise<PlayerSecretItem | null> {
    if (playerId === MATCH_KEY) return Promise.resolve(null);
    return this.read<PlayerSecretItem>(matchId, playerId, nowMs);
  }

  getMatch(matchId: string, nowMs: number): Promise<MatchSecretItem | null> {
    return this.read<MatchSecretItem>(matchId, MATCH_KEY, nowMs);
  }

  putItem(item: PlayerSecretItem | MatchSecretItem): TransactItem {
    return {
      Put: {
        TableName: this.table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(playerId)',
      },
    };
  }
}
