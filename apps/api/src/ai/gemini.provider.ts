import {
  AiProviderError,
  EMBEDDING_DIMENSIONS,
  type AiProvider,
  type Embedding,
  type EmbeddingDocument,
  type GenerateJsonRequest,
  type GenerateJsonResult,
  type QueryPurpose,
} from './ai-provider';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 15_000;
// Retries for temporary failures: attempt, wait ~0.5s, attempt, wait ~1s, attempt.
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;
// Statuses that usually mean "busy, try again soon": rate limited or a server hiccup.
// Anything else (400 bad request, 403 bad key, 404 unknown model) will fail the same way again.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
// batchEmbedContents accepts at most 100 texts per call.
const MAX_EMBED_BATCH = 100;
// gemini-embedding-2's task prefixes for queries.
const QUERY_TASKS: Record<QueryPurpose, string> = {
  search: 'search result',
  'question-answering': 'question answering',
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

type GeminiBatchEmbedResponse = {
  embeddings?: { values?: number[] }[];
};

type GeminiProviderOptions = {
  apiKey: string;
  model: string;
  embeddingModel: string;
  timeoutMs?: number;
  maxRetries?: number;
  // Injectable so tests don't really wait between retries.
  sleep?: (ms: number) => Promise<void>;
  // Injectable so tests can fake the network instead of calling Google.
  fetchFn?: typeof fetch;
};

// Talks to Gemini's REST API with plain fetch (no SDK), so every part of the request is visible.
export class GeminiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly embeddingModel: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor({
    apiKey,
    model,
    embeddingModel,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    fetchFn = fetch,
  }: GeminiProviderOptions) {
    this.apiKey = apiKey;
    this.model = model;
    this.embeddingModel = embeddingModel;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn;
    this.maxRetries = maxRetries;
    this.sleep = sleep;
  }

  async generateJson({ system, prompt, schema }: GenerateJsonRequest): Promise<GenerateJsonResult> {
    const body = await this.request<GeminiResponse>(`models/${this.model}:generateContent`, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        // Structured output: the model must reply with JSON matching this schema.
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    });

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

  // gemini-embedding-2 learns the task from a text prefix: documents are "title: … | text: …",
  // queries are "task: <task> | query: …".
  async embedDocuments(documents: EmbeddingDocument[]): Promise<Embedding[]> {
    const texts = documents.map((doc) => `title: ${doc.title || 'none'} | text: ${doc.text}`);
    const embeddings: Embedding[] = [];
    for (let i = 0; i < texts.length; i += MAX_EMBED_BATCH) {
      // eslint-disable-next-line no-await-in-loop
      embeddings.push(...(await this.embedBatch(texts.slice(i, i + MAX_EMBED_BATCH))));
    }
    return embeddings;
  }

  async embedQuery(query: string, purpose: QueryPurpose = 'search'): Promise<Embedding> {
    const [embedding] = await this.embedBatch([`task: ${QUERY_TASKS[purpose]} | query: ${query}`]);
    return embedding;
  }

  private async embedBatch(texts: string[]): Promise<Embedding[]> {
    if (texts.length === 0) return [];

    const body = await this.request<GeminiBatchEmbedResponse>(
      `models/${this.embeddingModel}:batchEmbedContents`,
      {
        requests: texts.map((text) => ({
          model: `models/${this.embeddingModel}`,
          content: { parts: [{ text }] },
          // Ask for 768 numbers instead of the default 3072: 4x less storage, nearly the same quality.
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      },
    );

    const embeddings = body.embeddings?.map((e) => e.values ?? []) ?? [];
    // Never trust the response: a wrong count or size would silently corrupt search results.
    if (
      embeddings.length !== texts.length ||
      embeddings.some((values) => values.length !== EMBEDDING_DIMENSIONS)
    ) {
      throw new AiProviderError('Gemini returned embeddings of an unexpected shape');
    }
    return embeddings;
  }

  // Every Gemini call goes through here: auth header, timeout, retries, and error mapping.
  private async request<T>(path: string, payload: unknown): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const outcome = await this.attempt(path, payload);
      if (outcome.ok) return outcome.body as T;

      if (!outcome.retryable || attempt >= this.maxRetries) {
        throw new AiProviderError(outcome.error);
      }
      // Exponential backoff with jitter: wait longer after each failure, plus a random bit so
      // many clients failing together don't all retry at the same instant.
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * RETRY_BASE_DELAY_MS;
      console.warn(`[ai] ${outcome.error}; retrying in ${Math.round(delay)}ms`);
      // eslint-disable-next-line no-await-in-loop
      await this.sleep(delay);
    }
  }

  private async attempt(
    path: string,
    payload: unknown,
  ): Promise<{ ok: true; body: unknown } | { ok: false; retryable: boolean; error: string }> {
    let res: Response;
    try {
      res = await this.fetchFn(`${GEMINI_BASE_URL}/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The key goes in a header, never in the URL, so it doesn't end up in request logs.
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
        // A slow model must not hang our API request forever.
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        // Not retried: the user has already waited the full timeout once.
        return { ok: false, retryable: false, error: 'Gemini request failed: timed out' };
      }
      return { ok: false, retryable: true, error: 'Gemini request failed: network error' };
    }

    if (!res.ok) {
      // Don't echo the body to the client: it can contain details we don't want to leak.
      return {
        ok: false,
        retryable: RETRYABLE_STATUSES.has(res.status),
        error: `Gemini returned HTTP ${res.status}`,
      };
    }

    return { ok: true, body: await res.json() };
  }
}
