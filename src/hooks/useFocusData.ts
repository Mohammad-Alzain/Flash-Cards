import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

interface FocusData<T> {
  data: T;
  /** True only during the very first load. */
  loading: boolean;
  /** True while a pull-to-refresh is in flight. */
  refreshing: boolean;
  error: unknown;
  /** Re-run the loader silently (e.g. after a mutation). */
  reload: () => Promise<void>;
  /** Pull-to-refresh handler. */
  refresh: () => Promise<void>;
}

/**
 * Loads screen data every time the screen gains focus, with pull-to-refresh
 * support. Replaces the useState/useFocusEffect/onRefresh boilerplate.
 */
export function useFocusData<T>(loader: () => Promise<T>, initial: T, label = 'screen'): FocusData<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    try {
      const next = await loaderRef.current();
      setData(next);
      setError(null);
    } catch (e) {
      console.error(`Failed to load ${label} data:`, e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [label]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, loading, refreshing, error, reload, refresh };
}
