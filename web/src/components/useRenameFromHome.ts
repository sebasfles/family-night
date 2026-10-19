import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { api } from '../api/client';
import { storeIdentity } from '../identity/identity';
import type { Identity } from '../identity/storage';
import { useToast } from './useToast';

export function useRenameFromHome() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const settled = useRef<Promise<void>>(Promise.resolve());
  const currentIdentity = () => queryClient.getQueryData<Identity>(['identity']);
  const mutation = useMutation({
    mutationFn: (name: string) => api.rename(name),
    onMutate: (name) => {
      const previous = currentIdentity();
      if (previous) storeIdentity(queryClient, { ...previous, name });
      return previous;
    },
    onSuccess: ({ player }) => {
      const current = currentIdentity();
      if (current) storeIdentity(queryClient, { ...current, name: player.name });
    },
    onError: (error, _name, previous) => {
      if (previous) storeIdentity(queryClient, previous);
      toast(error.message);
    },
  });

  return {
    isPending: mutation.isPending,
    rename: (name: string) => {
      settled.current = mutation.mutateAsync(name).then(
        () => undefined,
        () => undefined,
      );
    },
    settled: () => settled.current,
  };
}
