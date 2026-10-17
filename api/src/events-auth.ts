export interface EventsAuthResult {
  isAuthorized: boolean;
}

export const handler = (): Promise<EventsAuthResult> => Promise.resolve({ isAuthorized: false });
