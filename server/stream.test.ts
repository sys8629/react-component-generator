import { describe, it, expect } from 'vitest';
import { parseSSEData, anthropicDelta, geminiDelta, toNdjsonStream } from './stream';

function toStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const data of parseSSEData(stream)) out.push(data);
  return out;
}

describe('parseSSEData', () => {
  it('이벤트마다 data 페이로드를 추출한다', async () => {
    const stream = toStream(['event: a\ndata: {"x":1}\n\ndata: {"x":2}\n\n']);
    expect(await collect(stream)).toEqual(['{"x":1}', '{"x":2}']);
  });

  it('청크 경계에서 잘린 이벤트를 이어 붙인다', async () => {
    const stream = toStream(['data: {"x"', ':1}\n\ndata: {"x":2}', '\n\n']);
    expect(await collect(stream)).toEqual(['{"x":1}', '{"x":2}']);
  });

  it('CRLF 줄바꿈도 처리한다', async () => {
    const stream = toStream(['data: {"x":1}\r\n\r\ndata: {"x":2}\r\n\r\n']);
    expect(await collect(stream)).toEqual(['{"x":1}', '{"x":2}']);
  });

  it('CRLF가 청크 경계에서 CR과 LF로 갈라져도 이벤트를 분리한다', async () => {
    const stream = toStream(['data: {"x":1}\r\n\r', '\ndata: {"x":2}\r\n\r\n']);
    expect(await collect(stream)).toEqual(['{"x":1}', '{"x":2}']);
  });

  it('마지막 이벤트 뒤에 빈 줄이 없어도 내보낸다', async () => {
    const stream = toStream(['data: {"x":1}']);
    expect(await collect(stream)).toEqual(['{"x":1}']);
  });

  it('멀티바이트 문자가 청크 사이에서 잘려도 깨지지 않는다', async () => {
    const bytes = new TextEncoder().encode('data: 한글\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 8));
        controller.enqueue(bytes.slice(8));
        controller.close();
      },
    });
    expect(await collect(stream)).toEqual(['한글']);
  });
});

describe('anthropicDelta', () => {
  it('content_block_delta의 text_delta 텍스트를 반환한다', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(anthropicDelta(data)).toBe('const A');
  });

  it('텍스트가 없는 이벤트는 빈 문자열을 반환한다', () => {
    expect(anthropicDelta(JSON.stringify({ type: 'message_start' }))).toBe('');
  });

  it('overloaded_error 이벤트는 503이 포함된 에러를 던진다', () => {
    const data = JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
    expect(() => anthropicDelta(data)).toThrow('Claude API error: 503');
  });

  it('rate_limit_error 이벤트는 429가 포함된 에러를 던진다', () => {
    const data = JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } });
    expect(() => anthropicDelta(data)).toThrow('Claude API error: 429');
  });

  it('그 밖의 error 이벤트는 에러 타입을 담아 던진다', () => {
    const data = JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } });
    expect(() => anthropicDelta(data)).toThrow('Claude API error: api_error');
  });

  it('max_tokens로 끝나면 잘림 에러를 던진다', () => {
    const data = JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } });
    expect(() => anthropicDelta(data)).toThrow('너무 길어');
  });
});

describe('geminiDelta', () => {
  it('candidates의 parts 텍스트를 이어 붙여 반환한다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'const ' }, { text: 'A' }] } }],
    });
    expect(geminiDelta(data)).toBe('const A');
  });

  it('candidates가 없으면 빈 문자열을 반환한다', () => {
    expect(geminiDelta(JSON.stringify({}))).toBe('');
  });

  it('finishReason이 MAX_TOKENS면 잘림 에러를 던진다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(() => geminiDelta(data)).toThrow('너무 길어');
  });
});

async function* source(parts: string[], failWith?: Error): AsyncGenerator<string> {
  for (const part of parts) yield part;
  if (failWith) throw failWith;
}

async function readLines(stream: ReadableStream<Uint8Array>): Promise<object[]> {
  const text = await new Response(stream).text();
  return text.trim().split('\n').map((line) => JSON.parse(line));
}

describe('toNdjsonStream', () => {
  const finalize = (text: string) => `final:${text}`;
  const toMessage = (err: unknown) => (err instanceof Error ? err.message : 'unknown');

  it('조각마다 delta 이벤트를 내보내고 마지막에 가공된 done을 내보낸다', async () => {
    const lines = await readLines(toNdjsonStream(source(['a', 'b']), finalize, toMessage));
    expect(lines).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'delta', text: 'b' },
      { type: 'done', code: 'final:ab' },
    ]);
  });

  it('소스가 실패하면 error 이벤트를 내보내고 done은 없다', async () => {
    const lines = await readLines(toNdjsonStream(source(['a'], new Error('boom')), finalize, toMessage));
    expect(lines).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'error', error: 'boom' },
    ]);
  });

  it('소비자가 취소하면 소스를 중단하고 예외를 던지지 않는다', async () => {
    let finished = false;
    async function* endless(): AsyncGenerator<string> {
      try {
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          yield 'x';
        }
      } finally {
        finished = true;
      }
    }
    const stream = toNdjsonStream(endless(), finalize, toMessage);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(finished).toBe(true);
  });
});
