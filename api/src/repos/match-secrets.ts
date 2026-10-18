import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { ImpostorSecret } from '@family-night/shared';
import { epochSeconds } from '../lib/time.ts';
import { isWriteConflict, type TransactItem } from './db.ts';

export const MATCH_KEY = '#MATCH';
const GUESS_PREFIX = '#GUESS#';

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

export interface WavelengthRoundItem {
  matchId: string;
  playerId: typeof MATCH_KEY;
  round: number;
  psychicId: string;
  target: number;
  ttl: number;
}

export interface DialGuessItem {
  matchId: string;
  playerId: string;
  round: number;
  guesserId: string;
  value: number;
  createdAt: string;
  ttl: number;
}

function guessPrefix(round: number): string {
  return `${GUESS_PREFIX}${String(round).padStart(2, '0')}#`;
}

export function guessKey(round: number, guesserId: string): string {
  return guessPrefix(round) + guesserId;
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
    if (playerId.startsWith('#')) return Promise.resolve(null);
    return this.read<PlayerSecretItem>(matchId, playerId, nowMs);
  }

  getMatch(matchId: string, nowMs: number): Promise<MatchSecretItem | null> {
    return this.read<MatchSecretItem>(matchId, MATCH_KEY, nowMs);
  }

  getRound(matchId: string, nowMs: number): Promise<WavelengthRoundItem | null> {
    return this.read<WavelengthRoundItem>(matchId, MATCH_KEY, nowMs);
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

  putRoundItem(item: WavelengthRoundItem): TransactItem {
    return { Put: { TableName: this.table, Item: item } };
  }

  async putGuess(guess: Omit<DialGuessItem, 'playerId'>): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.table,
          Item: { ...guess, playerId: guessKey(guess.round, guess.guesserId) },
          ConditionExpression: 'attribute_not_exists(playerId)',
        }),
      );
      return true;
    } catch (error) {
      if (isWriteConflict(error)) return false;
      throw error;
    }
  }

  async listGuesses(matchId: string, round: number, nowMs: number): Promise<DialGuessItem[]> {
    const guesses: DialGuessItem[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'matchId = :matchId AND begins_with(playerId, :prefix)',
          ExpressionAttributeValues: { ':matchId': matchId, ':prefix': guessPrefix(round) },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      guesses.push(...((page.Items ?? []) as DialGuessItem[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    const now = epochSeconds(nowMs);
    return guesses.filter((guess) => guess.ttl > now);
  }

  deleteGuessItem(guess: DialGuessItem): TransactItem {
    return {
      Delete: { TableName: this.table, Key: { matchId: guess.matchId, playerId: guess.playerId } },
    };
  }
}
