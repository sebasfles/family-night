import type { TransactItem } from './db.ts';

export interface PlayerNameItem {
  name: string;
  playerId: string;
  createdAt: string;
}

export class PlayerNamesRepo {
  private readonly table: string;

  constructor(table: string) {
    this.table = table;
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
}
