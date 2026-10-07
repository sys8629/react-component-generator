export const MAX_HISTORY = 20;

/** 프롬프트를 히스토리 맨 앞에 추가한다. 중복은 앞으로 옮기고, 최대 개수를 넘으면 오래된 것을 버린다. */
export function addToHistory(history: string[], prompt: string): string[] {
  const trimmed = prompt.trim();
  if (!trimmed) return history;
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, MAX_HISTORY);
}
