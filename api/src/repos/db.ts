import { DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

export type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

export interface TableNames {
  players: string;
  playerNames: string;
  rooms: string;
  roomMembers: string;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function createDocumentClient(config: DynamoDBClientConfig = {}): DynamoDBDocumentClient {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({ ...(endpoint ? { endpoint } : {}), ...config }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
}

export async function transactWrite(
  client: DynamoDBDocumentClient,
  items: TransactItem[],
): Promise<void> {
  await client.send(new TransactWriteCommand({ TransactItems: items }));
}

const conflictReasons = new Set(['ConditionalCheckFailed', 'TransactionConflict']);

export function isWriteConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ConditionalCheckFailedException') return true;
  if (error.name !== 'TransactionCanceledException') return false;
  const reasons = (error as { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
  return reasons?.some((reason) => conflictReasons.has(reason.Code ?? '')) ?? false;
}
