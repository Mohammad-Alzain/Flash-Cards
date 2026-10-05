import { useCallback, useEffect, useState } from 'react';
import { settingsRepository } from '../core/db/repositories/settingsRepository';

/**
 * A persisted string setting: loads once, updates optimistically and writes
 * through to the settings table.
 */
export function useSetting(key: string, defaultValue: string) {
  const [value, setValue] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    settingsRepository
      .get(key, defaultValue)
      .then((v) => {
        if (mounted) setValue(v);
      })
      .finally(() => mounted && setLoaded(true));
    return () => {
      mounted = false;
    };
  }, [key, defaultValue]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      settingsRepository.set(key, next).catch((e) => console.error(`Failed to save setting ${key}:`, e));
    },
    [key]
  );

  return [value, update, loaded] as const;
}

/** Boolean setting stored as '1' / '0'. */
export function useBoolSetting(key: string, defaultValue: boolean) {
  const [raw, setRaw, loaded] = useSetting(key, defaultValue ? '1' : '0');
  const set = useCallback((v: boolean) => setRaw(v ? '1' : '0'), [setRaw]);
  return [raw !== '0', set, loaded] as const;
}
