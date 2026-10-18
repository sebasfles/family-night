import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { TransactItem } from './db.ts';

export interface PlayerItem {
  playerId: string;
  name: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
}

export class PlayersRepo {
  private readonly client: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.client = client;
    this.table = table;
  }

  async get(playerId: string): Promise<PlayerItem | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { playerId }, ConsistentRead: true }),
    );
    return (Item as PlayerItem | undefined) ?? null;
  }

  createItem(player: PlayerItem): TransactItem {
    return {
      Put: {
        TableName: this.table,
        Item: player,
        ConditionExpression: 'attribute_not_exists(playerId)',
      },
    };
  }

  renameItem(playerId: string, from: string, to: string): TransactItem {
    return {
      Update: {
        TableName: this.table,
        Key: { playerId },
        UpdateExpression: 'SET #name = :to',
        ConditionExpression: '#name = :from',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':from': from, ':to': to },
      },
    };
  }

  async touch(playerId: string, lastSeenAt: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { playerId },
        UpdateExpression: 'SET lastSeenAt = :lastSeenAt',
        ConditionExpression: 'attribute_exists(playerId)',
        ExpressionAttributeValues: { ':lastSeenAt': lastSeenAt },
      }),
    );
  }
}
