import { describe, it, expect, vi } from 'vitest';
import { readNdjson } from './ndjson';

function toStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const item of readNdjson(stream)) out.push(item);
  return out;
}

describe('readNdjson', () => {
  it('줄마다 JSON을 파싱한다', async () => {
    const stream = toStream(['{"a":1}\n{"a":2}\n']);
    expect(await collect(stream)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('청크 경계에서 잘린 줄을 이어 붙인다', async () => {
    const stream = toStream(['{"a"', ':1}\n{"a":2}', '\n']);
    expect(await collect(stream)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('빈 줄은 무시한다', async () => {
    const stream = toStream(['\n{"a":1}\n\n']);
    expect(await collect(stream)).toEqual([{ a: 1 }]);
  });

  it('소비를 중간에 멈추면 원본 스트림을 취소한다', async () => {
    const cancelled = vi.fn();
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"a":1}\n'));
      },
      cancel: cancelled,
    });
    for await (const item of readNdjson(stream)) {
      expect(item).toEqual({ a: 1 });
      break;
    }
    expect(cancelled).toHaveBeenCalled();
  });

  it('마지막 줄에 개행이 없어도 파싱한다', async () => {
    const stream = toStream(['{"a":1}']);
    expect(await collect(stream)).toEqual([{ a: 1 }]);
  });
});
