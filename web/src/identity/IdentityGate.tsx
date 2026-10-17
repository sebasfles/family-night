import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { bootstrapIdentity, IdentityContext } from './identity';

export function IdentityGate({ children }: { children: ReactNode }) {
  const identity = useQuery({
    queryKey: ['identity'],
    queryFn: bootstrapIdentity,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (identity.isPending) {
    return (
      <Screen>
        <p role="status" className="text-cream/80">
          Preparando tu lugar…
        </p>
      </Screen>
    );
  }

  if (identity.isError) {
    return (
      <Screen>
        <h1 className="text-2xl font-bold">No pudimos conectar con el servidor</h1>
        <p className="text-cream/80">{identity.error.message}</p>
        <Button onClick={() => void identity.refetch()}>Reintentar</Button>
      </Screen>
    );
  }

  return <IdentityContext value={identity.data}>{children}</IdentityContext>;
}
