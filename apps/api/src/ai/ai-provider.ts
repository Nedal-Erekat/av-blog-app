// The one contract the rest of the app depends on. Services never import Gemini (or any
// vendor) directly, so switching providers means writing one new class, not touching features.

export type JsonSchema = Record<string, unknown>;

export type GenerateJsonRequest = {
  // Standing instructions for the model: its role and rules. Kept separate from the user
  // content so untrusted text (a blog post) is never mixed into our instructions.
  system: string;
  prompt: string;
  // The JSON shape we want back. The provider asks the model to follow it.
  schema: JsonSchema;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type GenerateJsonResult = {
  // Deliberately `unknown`: the caller must validate it before trusting it.
  data: unknown;
  usage: TokenUsage;
  model: string;
};

// Every embedding is a list of this many numbers. It must match the vector(768) column in
// prisma/schema.prisma: vectors of different sizes can't be compared.
export const EMBEDDING_DIMENSIONS = 768;

export type Embedding = number[];

// A piece of text we want to be able to find later, e.g. one chunk of a blog post.
export type EmbeddingDocument = {
  title: string;
  text: string;
};

// Why a query is being embedded. Models tune the vector to the task: a search query should
// match relevant posts, a question should match passages that contain its answer.
export type QueryPurpose = 'search' | 'question-answering';

// --- Tool calling (agents) ---------------------------------------------------------------
// A tool the model may ask us to run. The model never runs anything itself: it replies with
// "please call search_posts with {query: 'docker'}", our code runs it, and sends back the result.
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: JsonSchema;
};

export type ToolCall = {
  // Some models give each call an id that the result must echo back.
  id?: string;
  name: string;
  args: unknown;
};

export type ChatMessage =
  | { role: 'user'; text: string }
  | {
      role: 'assistant';
      text: string;
      toolCalls: ToolCall[];
      // The provider's own copy of this reply, replayed verbatim on the next turn. Gemini hides
      // "thought signatures" in it that must come back unchanged for multi-step tool use.
      raw?: unknown;
    }
  | { role: 'tool'; results: { callId?: string; name: string; output: unknown }[] };

export type ChatRequest = {
  system: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
};

export type ChatResult = {
  message: Extract<ChatMessage, { role: 'assistant' }>;
  usage: TokenUsage;
  model: string;
};

export interface AiProvider {
  // One turn of a tool-using conversation: the reply is text, tool calls, or both.
  chat(request: ChatRequest): Promise<ChatResult>;
  generateJson(request: GenerateJsonRequest): Promise<GenerateJsonResult>;
  // Documents and queries are embedded differently on purpose: a short question and a long
  // paragraph that answers it should land close together. See "asymmetric retrieval".
  embedDocuments(documents: EmbeddingDocument[]): Promise<Embedding[]>;
  embedQuery(query: string, purpose?: QueryPurpose): Promise<Embedding>;
}

// Thrown for anything that goes wrong talking to the model: network, timeout, quota, bad output.
export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}
