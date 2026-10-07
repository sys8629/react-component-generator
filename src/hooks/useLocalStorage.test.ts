import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('저장된 값이 없으면 초기값을 사용한다', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'init'));
    expect(result.current[0]).toBe('init');
  });

  it('저장된 값이 있으면 그 값으로 시작한다', () => {
    localStorage.setItem('k', JSON.stringify('saved'));
    const { result } = renderHook(() => useLocalStorage('k', 'init'));
    expect(result.current[0]).toBe('saved');
  });

  it('값을 바꾸면 localStorage에 저장된다', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'init'));
    act(() => result.current[1]('next'));
    expect(JSON.parse(localStorage.getItem('k')!)).toBe('next');
  });

  it('updater 함수를 지원한다', () => {
    const { result } = renderHook(() => useLocalStorage('k', 1));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(2);
  });

  it('언마운트 후 다시 마운트해도 값이 유지된다', () => {
    const first = renderHook(() => useLocalStorage('k', 'init'));
    act(() => first.result.current[1]('kept'));
    first.unmount();
    const second = renderHook(() => useLocalStorage('k', 'init'));
    expect(second.result.current[0]).toBe('kept');
  });
});
