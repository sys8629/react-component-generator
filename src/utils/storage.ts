/** localStorage에서 JSON 값을 읽는다. 값이 없거나 깨져 있으면 fallback을 반환한다. */
export function readStorage<T>(key: string, fallback: T, revive?: (raw: unknown) => T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return fallback;
    const raw: unknown = JSON.parse(item);
    return revive ? revive(raw) : (raw as T);
  } catch {
    return fallback;
  }
}

/** localStorage에 JSON으로 저장한다. 용량 초과 등 실패는 무시한다. */
export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패 시에도 앱은 메모리 상태로 계속 동작한다.
  }
}
