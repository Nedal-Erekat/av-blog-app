import { AiProviderError, EMBEDDING_DIMENSIONS } from '../../src/ai';
import { GeminiProvider } from '../../src/ai/gemini.provider';

const request = { system: 'Be helpful.', prompt: 'Hello', schema: { type: 'object' } };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function providerWith(fetchFn: jest.Mock) {
  return new GeminiProvider({
    apiKey: 'test-key',
    model: 'gemini-test',
    embeddingModel: 'embed-test',
    fetchFn: fetchFn as unknown as typeof fetch,
    sleep: async () => undefined,
  });
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GeminiProvider.generateJson', () => {
  it('sends the key in a header, asks for JSON, and parses the reply', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"answer":42}' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 },
      }),
    );

    const result = await providerWith(fetchFn).generateJson(request);

    expect(result).toEqual({
      data: { answer: 42 },
      model: 'gemini-test',
      usage: { inputTokens: 12, outputTokens: 3 },
    });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
    );
    expect(url).not.toContain('test-key');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe('Be helpful.');
    expect(body.generationConfig).toEqual({
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
    });
  });

  it('fails after retrying when the quota stays exhausted (429)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ error: { message: 'quota' } }, 429));

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(
      new AiProviderError('Gemini returned HTTP 429'),
    );
    expect(fetchFn).toHaveBeenCalledTimes(3); // 1 attempt + 2 retries
  });

  it('recovers when a temporary failure clears up on retry', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
      );

    await expect(providerWith(fetchFn).generateJson(request)).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('waits longer before each retry (exponential backoff)', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const provider = new GeminiProvider({
      apiKey: 'k',
      model: 'm',
      embeddingModel: 'e',
      sleep,
      fetchFn: jest.fn().mockResolvedValue(jsonResponse({}, 500)) as unknown as typeof fetch,
    });

    await expect(provider.generateJson(request)).rejects.toThrow('HTTP 500');
    const [first, second] = sleep.mock.calls.map(([ms]) => ms);
    expect(first).toBeGreaterThanOrEqual(500);
    expect(first).toBeLessThan(1000);
    expect(second).toBeGreaterThanOrEqual(1000);
    expect(second).toBeLessThan(1500);
  });

  it('does not retry errors that would fail the same way again (400, 403, 404)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({}, 403));

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow('HTTP 403');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fails when the model returns no content', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse({ candidates: [{ finishReason: 'SAFETY' }] }));

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(
      /no content \(SAFETY\)/,
    );
  });

  it('fails when the model returns text that is not JSON', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ candidates: [{ content: { parts: [{ text: 'Sure! Here you go' }] } }] }),
      );

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(/invalid JSON/);
  });

  it('reports a timeout distinctly from other network errors', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    const fetchFn = jest.fn().mockRejectedValue(timeout);

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(/timed out/);
    expect(fetchFn).toHaveBeenCalledTimes(1); // timeouts are not retried
  });
});

describe('GeminiProvider embeddings', () => {
  const vector = (value: number) => Array<number>(EMBEDDING_DIMENSIONS).fill(value);

  it('embeds documents with the title/text prefix and asks for 768 dimensions', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ embeddings: [{ values: vector(0.1) }, { values: vector(0.2) }] }),
      );

    const result = await providerWith(fetchFn).embedDocuments([
      { title: 'Docker', text: 'Containers are great.' },
      { title: '', text: 'No title here.' },
    ]);

    expect(result).toEqual([vector(0.1), vector(0.2)]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/embed-test:batchEmbedContents',
    );
    const { requests } = JSON.parse(init.body);
    expect(requests[0]).toEqual({
      model: 'models/embed-test',
      content: { parts: [{ text: 'title: Docker | text: Containers are great.' }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    });
    expect(requests[1].content.parts[0].text).toBe('title: none | text: No title here.');
  });

  it('embeds a query with the search task prefix', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse({ embeddings: [{ values: vector(0.3) }] }));

    await expect(providerWith(fetchFn).embedQuery('how to deploy')).resolves.toEqual(vector(0.3));
    const { requests } = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(requests[0].content.parts[0].text).toBe('task: search result | query: how to deploy');
  });

  it('embeds a question with the question answering task prefix', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse({ embeddings: [{ values: vector(0.3) }] }));

    await providerWith(fetchFn).embedQuery('why postgres?', 'question-answering');
    const { requests } = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(requests[0].content.parts[0].text).toBe(
      'task: question answering | query: why postgres?',
    );
  });

  it('splits more than 100 documents into several batch calls', async () => {
    const fetchFn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const { requests } = JSON.parse(init.body as string);
      return jsonResponse({ embeddings: requests.map(() => ({ values: vector(0) })) });
    });
    const docs = Array.from({ length: 150 }, (_, i) => ({ title: 't', text: `chunk ${i}` }));

    const result = await providerWith(fetchFn).embedDocuments(docs);

    expect(result).toHaveLength(150);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('rejects embeddings of the wrong size', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse({ embeddings: [{ values: [1, 2, 3] }] }));

    await expect(providerWith(fetchFn).embedQuery('hi')).rejects.toThrow(/unexpected shape/);
  });
});

describe('GeminiProvider.chat (tool calling)', () => {
  const tools = [
    { name: 'search_posts', description: 'Search', parameters: { type: 'object', properties: {} } },
  ];

  it('declares tools and turns functionCall parts into tool calls, skipping thoughts', async () => {
    const content = {
      role: 'model',
      parts: [
        { text: 'thinking...', thought: true },
        { text: 'Let me search.' },
        {
          functionCall: { id: 'c1', name: 'search_posts', args: { query: 'x' } },
          thoughtSignature: 'sig',
        },
      ],
    };
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content }],
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 5 },
      }),
    );

    const result = await providerWith(fetchFn).chat({
      system: 'sys',
      messages: [{ role: 'user', text: 'hi' }],
      tools,
    });

    expect(result.message).toEqual({
      role: 'assistant',
      text: 'Let me search.',
      toolCalls: [{ id: 'c1', name: 'search_posts', args: { query: 'x' } }],
      raw: content,
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.tools).toEqual([
      {
        functionDeclarations: [
          {
            name: 'search_posts',
            description: 'Search',
            parametersJsonSchema: tools[0].parameters,
          },
        ],
      },
    ]);
  });

  it('replays the raw model turn (with its thought signature) and sends matching tool results', async () => {
    const raw = {
      role: 'model',
      parts: [
        { functionCall: { id: 'c1', name: 'search_posts', args: {} }, thoughtSignature: 'sig' },
      ],
    };
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ candidates: [{ content: { parts: [{ text: 'Done' }] } }] }),
      );

    await providerWith(fetchFn).chat({
      system: 'sys',
      tools,
      messages: [
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: '', toolCalls: [], raw },
        { role: 'tool', results: [{ callId: 'c1', name: 'search_posts', output: ['a'] }] },
      ],
    });

    const { contents } = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      raw,
      {
        role: 'user',
        parts: [
          { functionResponse: { id: 'c1', name: 'search_posts', response: { result: ['a'] } } },
        ],
      },
    ]);
  });

  it('fails when the reply has neither text nor tool calls', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }),
      );

    await expect(
      providerWith(fetchFn).chat({ system: 's', messages: [{ role: 'user', text: 'hi' }], tools }),
    ).rejects.toThrow(/no content \(STOP\)/);
  });
});
