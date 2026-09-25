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

export interface AiProvider {
  generateJson(request: GenerateJsonRequest): Promise<GenerateJsonResult>;
}

// Thrown for anything that goes wrong talking to the model: network, timeout, quota, bad output.
export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}
