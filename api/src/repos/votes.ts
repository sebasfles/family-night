import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { epochSeconds } from '../lib/time.ts';
import type { TransactItem } from './db.ts';

export interface VoteItem {
  matchId: string;
  roundVoter: string;
  round: number;
  voterId: string;
  targetId: string;
  createdAt: string;
  ttl: number;
}

function roundPrefix(round: number): string {
  return `${String(round).padStart(2, '0')}#`;
}

export function roundVoter(round: number, voterId: string): string {
  return roundPrefix(round) + voterId;
}

export class VotesRepo {
  private readonly client: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.client = client;
    this.table = table;
  }

  async put(vote: Omit<VoteItem, 'roundVoter'>): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: { ...vote, roundVoter: roundVoter(vote.round, vote.voterId) },
      }),
    );
  }

  async listRound(matchId: string, round: number, nowMs: number): Promise<VoteItem[]> {
    const votes: VoteItem[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'matchId = :matchId AND begins_with(roundVoter, :prefix)',
          ExpressionAttributeValues: { ':matchId': matchId, ':prefix': roundPrefix(round) },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      votes.push(...((page.Items ?? []) as VoteItem[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    const now = epochSeconds(nowMs);
    return votes.filter((vote) => vote.ttl > now);
  }

  deleteItem(vote: VoteItem): TransactItem {
    return {
      Delete: {
        TableName: this.table,
        Key: { matchId: vote.matchId, roundVoter: vote.roundVoter },
        ConditionExpression: 'targetId = :targetId',
        ExpressionAttributeValues: { ':targetId': vote.targetId },
      },
    };
  }
}
