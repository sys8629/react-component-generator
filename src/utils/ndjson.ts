/** NDJSON(줄 단위 JSON) 바이트 스트림을 파싱된 객체로 순서대로 내보낸다. */
export async function* readNdjson(stream: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line);
        newline = buffer.indexOf('\n');
      }
    }
    const rest = (buffer + decoder.decode()).trim();
    if (rest) yield JSON.parse(rest);
  } finally {
    // 중간에 빠져나오면(에러/중단) 연결이 열린 채 남지 않도록 취소한다.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
