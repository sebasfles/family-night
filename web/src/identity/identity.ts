import { createContext, use } from 'react';
import { api, isApiError } from '../api/client';
import { clearIdentity, loadIdentity, saveIdentity, type Identity } from './storage';

export async function bootstrapIdentity(): Promise<Identity> {
  const stored = loadIdentity();
  if (stored) {
    try {
      const me = await api.me();
      const identity = { ...stored, name: me.name };
      saveIdentity(identity);
      return identity;
    } catch (error) {
      if (!isApiError(error, 'UNAUTHORIZED')) throw error;
      clearIdentity();
    }
  }
  const created = await api.createPlayer();
  saveIdentity(created);
  return created;
}

export const IdentityContext = createContext<Identity | null>(null);

export function useIdentity(): Identity {
  const identity = use(IdentityContext);
  if (!identity) throw new Error('useIdentity must be used inside IdentityGate');
  return identity;
}
