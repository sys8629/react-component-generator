import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

function ndjsonBody(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      controller.close();
    },
  });
}

function mockGenerateOnce(code: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      body: ndjsonBody([
        { type: 'delta', text: code },
        { type: 'done', code },
      ]),
    }),
  );
}

// 테스트가 청크 전달 시점을 직접 제어하는 스트림 응답.
function mockControlledStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start: (c) => {
      controller = c;
    },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body }));
  return {
    send: (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
    close: () => controller.close(),
  };
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

describe('useComponentGenerator 스트리밍', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('스트리밍 엔드포인트로 요청한다', async () => {
    mockGenerateOnce('const A = () => null;');
    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', 'k', 'google'));
    expect(fetch).toHaveBeenCalledWith('/api/generate/stream', expect.objectContaining({ method: 'POST' }));
  });

  it('delta를 받는 동안 streaming.code가 누적된다', async () => {
    const stream = mockControlledStream();
    const { result } = renderHook(() => useComponentGenerator());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('카드', undefined, 'google');
    });

    stream.send({ type: 'delta', text: 'const ' });
    await waitFor(() => expect(result.current.streaming?.code).toBe('const '));
    stream.send({ type: 'delta', text: 'A' });
    await waitFor(() => expect(result.current.streaming?.code).toBe('const A'));
    expect(result.current.streaming?.prompt).toBe('카드');

    stream.send({ type: 'done', code: 'const A = 1;' });
    stream.close();
    await act(() => pending);
  });

  it('완료되면 streaming이 비워지고 같은 id의 컴포넌트가 추가된다', async () => {
    const stream = mockControlledStream();
    const { result } = renderHook(() => useComponentGenerator());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('카드', undefined, 'google');
    });
    stream.send({ type: 'delta', text: 'x' });
    await waitFor(() => expect(result.current.streaming).not.toBeNull());
    const streamingId = result.current.streaming!.id;

    stream.send({ type: 'done', code: 'const A = 1;' });
    stream.close();
    await act(() => pending);

    expect(result.current.streaming).toBeNull();
    expect(result.current.components[0]).toMatchObject({ id: streamingId, code: 'const A = 1;' });
  });

  it('스트림 중 error 이벤트가 오면 컴포넌트를 추가하지 않고 에러를 설정한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: ndjsonBody([
          { type: 'delta', text: 'const ' },
          { type: 'error', error: '중간 실패' },
        ]),
      }),
    );
    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).toBe('중간 실패');
    expect(result.current.streaming).toBeNull();
    expect(result.current.components).toEqual([]);
  });

  it('생성 중에 generate가 다시 호출돼도 요청을 중복으로 보내지 않는다', async () => {
    const stream = mockControlledStream();
    const { result } = renderHook(() => useComponentGenerator());
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.generate('카드', undefined, 'google');
      second = result.current.generate('카드', undefined, 'google');
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    stream.send({ type: 'done', code: 'const A = 1;' });
    stream.close();
    await act(async () => {
      await first;
      await second;
    });
    expect(result.current.components).toHaveLength(1);
  });

  it('연결 단계 HTTP 에러는 JSON 에러 메시지를 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '요청이 너무 많습니다.' }) }),
    );
    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).toBe('요청이 너무 많습니다.');
    expect(result.current.streaming).toBeNull();
  });
});
