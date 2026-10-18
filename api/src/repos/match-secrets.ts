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
const ROUND_PREFIX = '#ROUND#';
const CLUE_PREFIX = '#CLUE#';

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
  impostorIds: string[];
  ttl: number;
}

export interface WavelengthRoundItem {
  matchId: string;
  playerId: string;
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

export interface JustOneRoundItem {
  matchId: string;
  playerId: string;
  round: number;
  guesserId: string;
  wordId: string;
  word: string;
  ttl: number;
}

export interface ClueItem {
  matchId: string;
  playerId: string;
  round: number;
  authorId: string;
  clue: string;
  createdAt: string;
  ttl: number;
}

function twoDigits(round: number): string {
  return String(round).padStart(2, '0');
}

function guessPrefix(round: number): string {
  return `${GUESS_PREFIX}${twoDigits(round)}#`;
}

function cluePrefix(round: number): string {
  return `${CLUE_PREFIX}${twoDigits(round)}#`;
}

export function roundKey(round: number): string {
  return ROUND_PREFIX + twoDigits(round);
}

export function guessKey(round: number, guesserId: string): string {
  return guessPrefix(round) + guesserId;
}

export function clueKey(round: number, authorId: string): string {
  return cluePrefix(round) + authorId;
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

  getRound(matchId: string, round: number, nowMs: number): Promise<WavelengthRoundItem | null> {
    return this.read<WavelengthRoundItem>(matchId, roundKey(round), nowMs);
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

  putRoundItem(
    item: Omit<WavelengthRoundItem, 'playerId'> | Omit<JustOneRoundItem, 'playerId'>,
  ): TransactItem {
    return {
      Put: {
        TableName: this.table,
        Item: { ...item, playerId: roundKey(item.round) },
        ConditionExpression: 'attribute_not_exists(playerId)',
      },
    };
  }

  private async putOnce(item: { matchId: string; playerId: string }): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.table,
          Item: item,
          ConditionExpression: 'attribute_not_exists(playerId)',
        }),
      );
      return true;
    } catch (error) {
      if (isWriteConflict(error)) return false;
      throw error;
    }
  }

  private async listByPrefix<T extends { ttl: number }>(
    matchId: string,
    prefix: string,
    nowMs: number,
  ): Promise<T[]> {
    const items: T[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'matchId = :matchId AND begins_with(playerId, :prefix)',
          ExpressionAttributeValues: { ':matchId': matchId, ':prefix': prefix },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...((page.Items ?? []) as T[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    const now = epochSeconds(nowMs);
    return items.filter((item) => item.ttl > now);
  }

  private deleteItem(item: { matchId: string; playerId: string }): TransactItem {
    return {
      Delete: { TableName: this.table, Key: { matchId: item.matchId, playerId: item.playerId } },
    };
  }

  putGuess(guess: Omit<DialGuessItem, 'playerId'>): Promise<boolean> {
    return this.putOnce({ ...guess, playerId: guessKey(guess.round, guess.guesserId) });
  }

  listGuesses(matchId: string, round: number, nowMs: number): Promise<DialGuessItem[]> {
    return this.listByPrefix<DialGuessItem>(matchId, guessPrefix(round), nowMs);
  }

  deleteGuessItem(guess: DialGuessItem): TransactItem {
    return this.deleteItem(guess);
  }

  getJustOneRound(matchId: string, round: number, nowMs: number): Promise<JustOneRoundItem | null> {
    return this.read<JustOneRoundItem>(matchId, roundKey(round), nowMs);
  }

  putClue(clue: Omit<ClueItem, 'playerId'>): Promise<boolean> {
    return this.putOnce({ ...clue, playerId: clueKey(clue.round, clue.authorId) });
  }

  listClues(matchId: string, round: number, nowMs: number): Promise<ClueItem[]> {
    return this.listByPrefix<ClueItem>(matchId, cluePrefix(round), nowMs);
  }

  deleteClueItem(clue: ClueItem): TransactItem {
    return this.deleteItem(clue);
  }
}
