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
  });
}

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

  it('fails on a non-2xx response such as an exhausted quota', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ error: { message: 'quota' } }, 429));

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(
      new AiProviderError('Gemini returned HTTP 429'),
    );
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

  it('fails when the response envelope has an unexpected shape', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ candidates: 'not-an-array' }));

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(
      new AiProviderError('Gemini returned an unexpected response shape'),
    );
  });

  it('fails when the response body is not JSON', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('<html>oops</html>', { status: 200 }));

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(/non-JSON response/);
  });

  it('reports a timeout distinctly from other network errors', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    const fetchFn = jest.fn().mockRejectedValue(timeout);

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(/timed out/);
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

  it('rejects an embedding response of the wrong shape (validated, not cast)', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse({ embeddings: [{ values: ['not', 'numbers'] }] }));

    await expect(providerWith(fetchFn).embedQuery('hi')).rejects.toThrow(
      new AiProviderError('Gemini returned an unexpected response shape'),
    );
  });
});
