import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { GameStatus, LibraryResponse } from '../../shared/types';
import { api } from '../api';
import { useToast } from '../components/Toast';

export const libraryKey = ['library'] as const;
export const settingsKey = ['settings'] as const;
const syncKey = ['sync'] as const;

/** When the app opens, sync if the last sync is older than this. */
const AUTO_SYNC_AFTER_MS = 15 * 60 * 1000;

export function useLibrary() {
  return useQuery({ queryKey: libraryKey, queryFn: api.library });
}

export function useSync() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationKey: syncKey,
    mutationFn: api.sync,
    onSuccess: (library) => {
      queryClient.setQueryData(libraryKey, library);
      void queryClient.invalidateQueries({ queryKey: settingsKey });
    },
    onError: (err) => toast(err.message, 'error'),
  });
}

export function useIsSyncing() {
  return useIsMutating({ mutationKey: syncKey }) > 0;
}

export function useSetStatus() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ appId, status }: { appId: number; status: GameStatus }) => api.setStatus(appId, status),
    onMutate: async ({ appId, status }) => {
      await queryClient.cancelQueries({ queryKey: libraryKey });
      const previous = queryClient.getQueryData<LibraryResponse>(libraryKey);
      queryClient.setQueryData<LibraryResponse>(libraryKey, (library) =>
        library && {
          ...library,
          games: library.games.map((game) =>
            game.appId === appId
              ? {
                  ...game,
                  status,
                  finishedAt: status === 'finished' ? (game.finishedAt ?? new Date().toISOString()) : null,
                }
              : game,
          ),
        },
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(libraryKey, context.previous);
      toast(`Couldn't save that change. ${err.message}`, 'error');
    },
  });
}

/** Syncs once when the app opens, if auto-sync is on and the library is stale. */
export function useAutoSync() {
  const { data } = useLibrary();
  const { mutate: sync } = useSync();
  const checked = useRef(false);

  useEffect(() => {
    if (!data || checked.current) return;
    checked.current = true;
    if (!data.connected || !data.autoSync) return;
    const age = data.lastSyncAt ? Date.now() - Date.parse(data.lastSyncAt) : Infinity;
    if (age > AUTO_SYNC_AFTER_MS) sync();
  }, [data, sync]);
}
