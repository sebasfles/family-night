import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { TransactItem } from './db.ts';

export interface PlayerNameItem {
  name: string;
  playerId: string;
  createdAt: string;
}

export class PlayerNamesRepo {
  private readonly client: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.client = client;
    this.table = table;
  }

  async get(name: string): Promise<PlayerNameItem | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { name }, ConsistentRead: true }),
    );
    return (Item as PlayerNameItem | undefined) ?? null;
  }

  claimItem(item: PlayerNameItem): TransactItem {
    return {
      Put: {
        TableName: this.table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(#name)',
        ExpressionAttributeNames: { '#name': 'name' },
      },
    };
  }

  releaseItem(name: string, playerId: string): TransactItem {
    return {
      Delete: {
        TableName: this.table,
        Key: { name },
        ConditionExpression: 'attribute_not_exists(#name) OR playerId = :playerId',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':playerId': playerId },
      },
    };
  }
}
