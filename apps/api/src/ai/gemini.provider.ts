import {
  AiProviderError,
  type AiProvider,
  type GenerateJsonRequest,
  type GenerateJsonResult,
} from './ai-provider';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 15_000;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

type GeminiProviderOptions = {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  // Injectable so tests can fake the network instead of calling Google.
  fetchFn?: typeof fetch;
};

// Talks to Gemini's REST API with plain fetch (no SDK), so every part of the request is visible.
export class GeminiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor({
    apiKey,
    model,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = fetch,
  }: GeminiProviderOptions) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn;
  }

  async generateJson({ system, prompt, schema }: GenerateJsonRequest): Promise<GenerateJsonResult> {
    let res: Response;
    try {
      res = await this.fetchFn(`${GEMINI_BASE_URL}/models/${this.model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The key goes in a header, never in the URL, so it doesn't end up in request logs.
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            // Structured output: the model must reply with JSON matching this schema.
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
          },
        }),
        // A slow model must not hang our API request forever.
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason =
        err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'network error';
      throw new AiProviderError(`Gemini request failed: ${reason}`);
    }

    if (!res.ok) {
      // 429 = free-tier quota used up; 400/403 = bad request or key. Don't echo the body
      // to the client: it can contain details we don't want to leak.
      throw new AiProviderError(`Gemini returned HTTP ${res.status}`);
    }

    const body = (await res.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      // e.g. finishReason SAFETY: the model refused and returned no content.
      throw new AiProviderError(
        `Gemini returned no content (${body.candidates?.[0]?.finishReason ?? 'unknown'})`,
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new AiProviderError('Gemini returned invalid JSON');
    }

    return {
      data,
      model: this.model,
      usage: {
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
