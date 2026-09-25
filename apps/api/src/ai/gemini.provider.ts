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

  constructor({
    apiKey,
    model,
    embeddingModel,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = fetch,
  }: GeminiProviderOptions) {
    this.apiKey = apiKey;
    this.model = model;
    this.embeddingModel = embeddingModel;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn;
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

  // Every Gemini call goes through here: auth header, timeout, and error mapping in one place.
  private async request<T>(path: string, payload: unknown): Promise<T> {
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
      const reason =
        err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'network error';
      throw new AiProviderError(`Gemini request failed: ${reason}`);
    }

    if (!res.ok) {
      // 429 = free-tier quota used up; 400/403 = bad request or key. Don't echo the body
      // to the client: it can contain details we don't want to leak.
      throw new AiProviderError(`Gemini returned HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  }
}
