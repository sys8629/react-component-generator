import { describe, it, expect } from 'vitest';
import { addToHistory, MAX_HISTORY } from './history';

describe('addToHistory', () => {
  it('새 프롬프트를 맨 앞에 추가한다', () => {
    expect(addToHistory(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('중복 프롬프트는 맨 앞으로 옮기고 중복 저장하지 않는다', () => {
    expect(addToHistory(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('빈 프롬프트는 무시한다', () => {
    expect(addToHistory(['a'], '   ')).toEqual(['a']);
  });

  it('앞뒤 공백을 제거해 저장한다', () => {
    expect(addToHistory([], '  hi  ')).toEqual(['hi']);
  });

  it('최대 개수까지만 유지한다', () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => `p${i}`);
    const next = addToHistory(full, 'new');
    expect(next).toHaveLength(MAX_HISTORY);
    expect(next[0]).toBe('new');
    expect(next).not.toContain(`p${MAX_HISTORY - 1}`);
  });
});
