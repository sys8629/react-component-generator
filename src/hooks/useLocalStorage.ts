import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

/** useState와 같은 인터페이스로 값을 localStorage에 동기화한다. */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  revive?: (raw: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStorage(key, initial, revive));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue];
}
