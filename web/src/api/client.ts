import {
  PLAYER_ID_HEADER,
  PLAYER_TOKEN_HEADER,
  type CreatePlayerResponse,
  type ErrorCode,
  type ErrorResponse,
  type LeaveRoomResponse,
  type MeResponse,
  type RoomResponse,
  type TargetPlayerRequest,
} from '@family-night/shared';
import { loadIdentity } from '../identity/storage';

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR';

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;

  constructor(code: ClientErrorCode, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function isApiError(error: unknown, code?: ClientErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

const NETWORK_MESSAGE = 'No hay conexión con el servidor, revisa tu internet';
const UNEXPECTED_MESSAGE = 'Algo salió mal, intenta de nuevo';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface RequestOptions {
  body?: unknown;
  keepalive?: boolean;
}

const EMPTY_BODY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function headersFor(body: string, bodyHash: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  const identity = loadIdentity();
  if (identity) {
    headers[PLAYER_ID_HEADER] = identity.playerId;
    headers[PLAYER_TOKEN_HEADER] = identity.playerToken;
  }
  if (bodyHash) headers['x-amz-content-sha256'] = bodyHash;
  if (body) headers['content-type'] = 'application/json';
  return headers;
}

async function errorFrom(response: Response): Promise<ApiError> {
  try {
    const { error } = (await response.json()) as ErrorResponse;
    return new ApiError(error.code, response.status, error.message);
  } catch {
    return new ApiError('INTERNAL_ERROR', response.status, UNEXPECTED_MESSAGE);
  }
}

export async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const body = options.body === undefined ? '' : JSON.stringify(options.body);
  const bodyHash = method === 'GET' ? null : body ? await sha256Hex(body) : EMPTY_BODY_SHA256;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: headersFor(body, bodyHash),
      ...(body ? { body } : {}),
      ...(options.keepalive ? { keepalive: true } : {}),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 0, NETWORK_MESSAGE);
  }
  if (!response.ok) throw await errorFrom(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const room = (code: string, action = '') => `/rooms/${code}${action}`;

export const api = {
  createPlayer: () => request<CreatePlayerResponse>('POST', '/players'),
  me: () => request<MeResponse>('GET', '/players/me'),
  createRoom: () => request<RoomResponse>('POST', '/rooms'),
  getRoom: (code: string) => request<RoomResponse>('GET', room(code)),
  joinRoom: (code: string) => request<RoomResponse>('POST', room(code, '/join')),
  leaveRoom: (code: string) => request<LeaveRoomResponse>('POST', room(code, '/leave')),
  ping: (code: string) => request<RoomResponse>('POST', room(code, '/ping')),
  away: (code: string) => request<undefined>('POST', room(code, '/away'), { keepalive: true }),
  kick: (code: string, body: TargetPlayerRequest) =>
    request<RoomResponse>('POST', room(code, '/kick'), { body }),
  makeHost: (code: string, body: TargetPlayerRequest) =>
    request<RoomResponse>('POST', room(code, '/host'), { body }),
};
