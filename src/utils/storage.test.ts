import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readStorage, writeStorage } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('저장된 값이 없으면 fallback을 반환한다', () => {
    expect(readStorage('k', 'fallback')).toBe('fallback');
  });

  it('쓴 값을 그대로 읽는다', () => {
    writeStorage('k', { a: 1 });
    expect(readStorage('k', null)).toEqual({ a: 1 });
  });

  it('JSON이 깨져 있으면 fallback을 반환한다', () => {
    localStorage.setItem('k', '{broken');
    expect(readStorage('k', 'fallback')).toBe('fallback');
  });

  it('revive가 던지면 fallback을 반환한다', () => {
    writeStorage('k', 1);
    const revive = () => {
      throw new Error('invalid');
    };
    expect(readStorage('k', 'fallback', revive)).toBe('fallback');
  });

  it('revive로 저장값을 변환한다', () => {
    writeStorage('k', '2024-01-01T00:00:00.000Z');
    const value = readStorage<Date | null>('k', null, (raw) => new Date(raw as string));
    expect(value).toBeInstanceOf(Date);
  });

  it('저장소 쓰기가 실패해도 예외를 던지지 않는다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeStorage('k', 'v')).not.toThrow();
  });
});
