import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

function mockGenerateOnce(code: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code }) }),
  );
}

describe('useComponentGenerator 영속성', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('생성된 컴포넌트가 새로고침 후에도 복원되고 createdAt은 Date다', async () => {
    mockGenerateOnce('const A = () => null;');
    const first = renderHook(() => useComponentGenerator());
    await act(() => first.result.current.generate('카드', undefined, 'google'));
    await waitFor(() => expect(first.result.current.components).toHaveLength(1));
    first.unmount();

    const second = renderHook(() => useComponentGenerator());
    expect(second.result.current.components).toHaveLength(1);
    expect(second.result.current.components[0].prompt).toBe('카드');
    expect(second.result.current.components[0].createdAt).toBeInstanceOf(Date);
  });

  it('전체 삭제하면 저장된 목록도 비워진다', async () => {
    mockGenerateOnce('const A = () => null;');
    const first = renderHook(() => useComponentGenerator());
    await act(() => first.result.current.generate('카드', undefined, 'google'));
    act(() => first.result.current.clearAll());
    first.unmount();

    const second = renderHook(() => useComponentGenerator());
    expect(second.result.current.components).toHaveLength(0);
  });

  it('저장된 데이터 형식이 잘못되면 빈 목록으로 시작한다', () => {
    localStorage.setItem('rcg:components', JSON.stringify([{ nope: true }]));
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components).toEqual([]);
  });
});
