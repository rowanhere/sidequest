import { useCallback, useEffect, useState } from 'react';

export function useLocalStorageObject(key, defaultValue) {
  const load = useCallback(() => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (_) {
      return defaultValue;
    }
  }, [key, defaultValue]);

  const [value, setValue] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }, [key, value]);

  return [value, setValue];
}
