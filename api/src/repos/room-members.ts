import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { epochSeconds } from '../lib/time.ts';
import type { TransactItem } from './db.ts';

export interface MemberItem {
  roomCode: string;
  playerId: string;
  name: string;
  joinedAt: string;
  lastSeenAt: string;
  lastActiveAt: string;
  totalScore: number;
  ttl: number;
}

export class RoomMembersRepo {
  private readonly client: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.client = client;
    this.table = table;
  }

  async get(roomCode: string, playerId: string, nowMs: number): Promise<MemberItem | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { roomCode, playerId }, ConsistentRead: true }),
    );
    const member = Item as MemberItem | undefined;
    return member && member.ttl > epochSeconds(nowMs) ? member : null;
  }

  async list(roomCode: string, nowMs: number): Promise<MemberItem[]> {
    const members: MemberItem[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'roomCode = :roomCode',
          ExpressionAttributeValues: { ':roomCode': roomCode },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      members.push(...((page.Items ?? []) as MemberItem[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    const now = epochSeconds(nowMs);
    return members.filter((member) => member.ttl > now);
  }

  putItem(member: MemberItem): TransactItem {
    return { Put: { TableName: this.table, Item: member } };
  }

  deleteItem(roomCode: string, playerId: string): TransactItem {
    return { Delete: { TableName: this.table, Key: { roomCode, playerId } } };
  }

  async putExisting(member: MemberItem): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: member,
        ConditionExpression: 'attribute_exists(playerId)',
      }),
    );
  }
}
