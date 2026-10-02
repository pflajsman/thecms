import { anthropic } from './anthropic';
import { openAiCompatible } from './openai-compatible';
import { AiProviderError } from './types';

const prompt = { system: 'Be brief.', user: 'Hi', maxTokens: 50 };

function sseResponse(lines: string[], status = 200) {
  return new Response(lines.join('\n') + '\n', { status, headers: { 'Content-Type': 'text/event-stream' } });
}

function fakeFetch(response: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('OpenAI-compatible adapter', () => {
  it('streams text chunks and reads the usage at the end', async () => {
    const { fn, calls } = fakeFetch(
      sseResponse([
        'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}',
        '',
        'data: {"choices":[{"delta":{"content":"Ahoj"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":" světe"}}]}',
        '',
        'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":12,"completion_tokens":4}}',
        '',
        'data: [DONE]',
      ])
    );
    const texts: string[] = [];
    const usage = await openAiCompatible({ baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', fetch: fn }).stream(prompt, new AbortController().signal, (t) => texts.push(t));
    expect(texts).toEqual(['Ahoj', ' světe']);
    expect(usage).toEqual({ inputTokens: 12, outputTokens: 4 });
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ model: 'llama3.2', stream: true, max_tokens: 50, messages: [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'Hi' }] });
    expect(new Headers(calls[0].init.headers).has('Authorization')).toBe(false);
  });

  it('sends the key as a bearer token and maps a refused key without echoing it', async () => {
    const { fn, calls } = fakeFetch(new Response('{"error":{"message":"Invalid key sk-or-secret-9876"}}', { status: 401 }));
    const error = await openAiCompatible({ baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-or-secret-9876', model: 'x', fetch: fn })
      .stream(prompt, new AbortController().signal, () => {})
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({ code: 'AUTH' });
    expect((error as Error).message).not.toContain('sk-or-secret-9876');
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer sk-or-secret-9876');
  });

  it('maps rate limits, too-long input and unreachable services', async () => {
    const run = (response: Response | Error) =>
      openAiCompatible({ baseUrl: 'http://x/v1', model: 'm', fetch: (async () => { if (response instanceof Error) throw response; return response; }) as unknown as typeof fetch })
        .stream(prompt, new AbortController().signal, () => {})
        .catch((e: unknown) => e);
    expect(await run(new Response('slow down', { status: 429 }))).toMatchObject({ code: 'RATE_LIMIT' });
    expect(await run(new Response('maximum context length exceeded', { status: 400 }))).toMatchObject({ code: 'TOO_LONG' });
    expect(await run(new TypeError('fetch failed'))).toMatchObject({ code: 'UNREACHABLE' });
  });
});

describe('OpenAI-compatible adapter, failures inside a stream', () => {
  it('does not follow redirects', async () => {
    const { fn, calls } = fakeFetch(new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/internal' } }));
    const error = await openAiCompatible({ baseUrl: 'https://x.test/v1', model: 'm', fetch: fn }).stream(prompt, new AbortController().signal, () => {}).catch((e: unknown) => e);
    expect(calls[0].init.redirect).toBe('manual');
    expect(error).toMatchObject({ code: 'PROVIDER' });
  });

  it('fails on an error chunk instead of ending as if complete', async () => {
    const { fn } = fakeFetch(sseResponse(['data: {"choices":[{"delta":{"content":"Půl"}}]}', '', 'data: {"error":{"message":"Upstream provider failed"}}', '']));
    const texts: string[] = [];
    const error = await openAiCompatible({ baseUrl: 'http://x/v1', model: 'm', fetch: fn }).stream(prompt, new AbortController().signal, (t) => texts.push(t)).catch((e: unknown) => e);
    expect(texts).toEqual(['Půl']);
    expect(error).toMatchObject({ code: 'PROVIDER', message: expect.stringContaining('Upstream provider failed') });
  });

  it('marks an answer cut off at the token cap', async () => {
    const { fn } = fakeFetch(sseResponse(['data: {"choices":[{"delta":{"content":"Dlouhý"},"finish_reason":"length"}]}', '', 'data: [DONE]']));
    const usage = await openAiCompatible({ baseUrl: 'http://x/v1', model: 'm', fetch: fn }).stream(prompt, new AbortController().signal, () => {});
    expect(usage.truncated).toBe(true);
  });
});

describe('Anthropic adapter', () => {
  it('streams text deltas and reports input and output tokens', async () => {
    const { fn, calls } = fakeFetch(
      sseResponse([
        'event: message_start',
        'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-sonnet-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":12,"output_tokens":1}}}',
        '',
        'event: content_block_start',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Ahoj"}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" světe"}}',
        '',
        'event: content_block_stop',
        'data: {"type":"content_block_stop","index":0}',
        '',
        'event: message_delta',
        `data: {"type":"message_delta","delta":{"stop_reason":"${'end_turn'}","stop_sequence":null},"usage":{"output_tokens":5}}`,
        '',
        'event: message_stop',
        'data: {"type":"message_stop"}',
        '',
      ])
    );
    const texts: string[] = [];
    const usage = await anthropic({ apiKey: 'sk-ant-secret-1234', model: 'claude-sonnet-5', fetch: fn }).stream(prompt, new AbortController().signal, (t) => texts.push(t));
    expect(texts).toEqual(['Ahoj', ' světe']);
    expect(usage).toEqual({ inputTokens: 12, outputTokens: 5 });
    expect(new Headers(calls[0].init.headers).get('x-api-key')).toBe('sk-ant-secret-1234');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ model: 'claude-sonnet-5', max_tokens: 50, system: 'Be brief.', messages: [{ role: 'user', content: 'Hi' }], stream: true });
  });

  it('maps a refused key without echoing it', async () => {
    const { fn } = fakeFetch(
      new Response('{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key sk-ant-secret-1234"}}', { status: 401, headers: { 'Content-Type': 'application/json' } })
    );
    const error = await anthropic({ apiKey: 'sk-ant-secret-1234', model: 'claude-sonnet-5', fetch: fn })
      .stream(prompt, new AbortController().signal, () => {})
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'AUTH' });
    expect((error as Error).message).not.toContain('sk-ant-secret-1234');
  });

  it('marks an answer cut off at max_tokens', async () => {
    const { fn } = fakeFetch(
      sseResponse([
        'event: message_start',
        'data: {"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"claude-sonnet-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":3,"output_tokens":1}}}',
        '',
        'event: content_block_start',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Dlouhý"}}',
        '',
        'event: content_block_stop',
        'data: {"type":"content_block_stop","index":0}',
        '',
        'event: message_delta',
        'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens","stop_sequence":null},"usage":{"output_tokens":50}}',
        '',
        'event: message_stop',
        'data: {"type":"message_stop"}',
        '',
      ])
    );
    const usage = await anthropic({ apiKey: 'k', model: 'claude-sonnet-5', fetch: fn }).stream(prompt, new AbortController().signal, () => {});
    expect(usage).toEqual({ inputTokens: 3, outputTokens: 50, truncated: true });
  });
});
