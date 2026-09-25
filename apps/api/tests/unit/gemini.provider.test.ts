import { AiProviderError } from '../../src/ai';
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

  it('reports a timeout distinctly from other network errors', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    const fetchFn = jest.fn().mockRejectedValue(timeout);

    await expect(providerWith(fetchFn).generateJson(request)).rejects.toThrow(/timed out/);
  });
});
