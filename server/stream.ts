// LLM 스트리밍 응답(SSE)을 텍스트 조각으로 변환하는 순수 함수들.
// 부수효과(Bun.serve 등)가 없어 단위 테스트가 가능하다.

const TRUNCATED_MESSAGE = '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.';

/** SSE 바이트 스트림에서 이벤트별 `data:` 페이로드를 순서대로 꺼낸다. */
export async function* parseSSEData(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const extractData = (event: string): string | null => {
    const lines = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''));
    return lines.length > 0 ? lines.join('\n') : null;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // CR/LF가 청크 경계에서 갈라질 수 있으므로 누적 버퍼 전체를 정규화한다.
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const data = extractData(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (data !== null) yield data;
        boundary = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    const rest = extractData(buffer.replace(/\r\n/g, '\n'));
    if (rest !== null) yield rest;
  } finally {
    // 중간에 빠져나오면(취소/에러) 업스트림 연결도 닫는다.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Anthropic 스트림 이벤트에서 텍스트 조각을 꺼낸다. 에러/절단 이벤트는 던진다. */
export function anthropicDelta(data: string): string {
  const event = JSON.parse(data) as {
    type: string;
    delta?: { type?: string; text?: string; stop_reason?: string };
    error?: { type?: string };
  };

  if (event.type === 'error') {
    // 서버의 상태 코드 매핑(503/429)이 문자열 포함 여부에 의존하므로 에러 타입을 코드로 옮긴다.
    const errorType = event.error?.type;
    const code = errorType === 'overloaded_error' ? '503' : errorType === 'rate_limit_error' ? '429' : errorType;
    throw new Error(`Claude API error: ${code ?? 'stream'}`);
  }
  if (event.type === 'message_delta' && event.delta?.stop_reason === 'max_tokens') {
    throw new Error(TRUNCATED_MESSAGE);
  }
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text ?? '';
  }
  return '';
}

/** Gemini 스트림 청크에서 텍스트 조각을 꺼낸다. MAX_TOKENS 절단이면 던진다. */
export function geminiDelta(data: string): string {
  const chunk = JSON.parse(data) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = chunk.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error(TRUNCATED_MESSAGE);
  }
  return candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
}

/**
 * 텍스트 조각 소스를 NDJSON 이벤트(delta/done/error) 바이트 스트림으로 바꾼다.
 * 소비자가 취소하면 소스를 중단해 업스트림 연결도 닫히게 한다.
 */
export function toNdjsonStream(
  source: AsyncGenerator<string>,
  finalize: (text: string) => string,
  toMessage: (err: unknown) => string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const line = (event: object) => encoder.encode(`${JSON.stringify(event)}\n`);
  let text = '';

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await source.next();
        if (done) {
          controller.enqueue(line({ type: 'done', code: finalize(text) }));
          controller.close();
          return;
        }
        text += value;
        controller.enqueue(line({ type: 'delta', text: value }));
      } catch (err) {
        controller.enqueue(line({ type: 'error', error: toMessage(err) }));
        controller.close();
      }
    },
    async cancel() {
      await source.return(undefined).catch(() => {});
    },
  });
}
