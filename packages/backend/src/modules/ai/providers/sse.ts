/** The `data:` values of a server-sent event stream, one per event line. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let end = buffer.indexOf('\n');
    while (end >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, '');
      buffer = buffer.slice(end + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
      end = buffer.indexOf('\n');
    }
  }
  const last = buffer.trim();
  if (last.startsWith('data:')) yield last.slice(5).trim();
}
