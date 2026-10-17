import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import type { TestProject } from 'vitest/node';

const IMAGE = 'amazon/dynamodb-local:3.3.1';

declare module 'vitest' {
  export interface ProvidedContext {
    dynamoEndpoint: string;
  }
}

function docker(args: string[]): string {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export default async function setup(project: TestProject) {
  let container: string;
  try {
    container = docker([
      'run',
      '--detach',
      '--rm',
      '--publish',
      '127.0.0.1::8000',
      IMAGE,
      '-jar',
      'DynamoDBLocal.jar',
      '-inMemory',
      '-sharedDb',
    ]);
  } catch (error) {
    throw new Error(
      `api tests need Docker to run DynamoDB Local (${IMAGE}); start Docker and run again`,
      { cause: error },
    );
  }

  const stop = () => {
    docker(['rm', '--force', container]);
  };

  try {
    const address = docker(['port', container, '8000/tcp']).split('\n')[0] ?? '';
    const endpoint = `http://${address}`;
    const client = new DynamoDBClient({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });
    for (let attempt = 0; ; attempt++) {
      try {
        await client.send(new ListTablesCommand({}));
        break;
      } catch (error) {
        if (attempt >= 60) throw new Error('DynamoDB Local did not start', { cause: error });
        await delay(250);
      }
    }
    client.destroy();
    project.provide('dynamoEndpoint', endpoint);
  } catch (error) {
    stop();
    throw error;
  }

  return stop;
}
