import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { roomChannel, type RoomEvent } from '@family-night/shared';
import { HttpRequest } from '@smithy/protocol-http';
import type { AwsCredentialIdentityProvider } from '@smithy/types';
import { SignatureV4 } from '@smithy/signature-v4';
import { describeError, log } from '../lib/log.ts';

export type Publisher = (roomCode: string, events: RoomEvent[]) => Promise<void>;

interface PublishResult {
  failed?: unknown[];
}

export function createAppSyncPublisher(
  httpDomain: string,
  region: string,
  credentials: AwsCredentialIdentityProvider = defaultProvider(),
): Publisher {
  const signer = new SignatureV4({
    service: 'appsync',
    region,
    credentials,
    sha256: Sha256,
  });

  return async (roomCode, events) => {
    const channel = roomChannel(roomCode);
    const types = events.map((event) => event.type);
    try {
      const body = JSON.stringify({
        channel,
        events: events.map((event) => JSON.stringify(event)),
      });
      const signed = await signer.sign(
        new HttpRequest({
          method: 'POST',
          protocol: 'https:',
          hostname: httpDomain,
          path: '/event',
          headers: { host: httpDomain, 'content-type': 'application/json' },
          body,
        }),
      );
      const response = await fetch(`https://${httpDomain}/event`, {
        method: 'POST',
        headers: signed.headers,
        body,
      });
      const result = (await response.json().catch(() => ({}))) as PublishResult;
      const failed = result.failed?.length ?? 0;
      if (!response.ok || failed > 0) {
        log.error('publish failed', { channel, types, status: response.status, failed });
        return;
      }
      log.info('published', { channel, types });
    } catch (error) {
      log.error('publish failed', { channel, types, ...describeError(error) });
    }
  };
}

export const skipPublish: Publisher = (roomCode, events) => {
  log.info('publish skipped, EVENTS_HTTP_DOMAIN not set', {
    channel: roomChannel(roomCode),
    types: events.map((event) => event.type),
  });
  return Promise.resolve();
};
