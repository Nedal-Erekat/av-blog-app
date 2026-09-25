import { env } from '../config/env';
import type { AiProvider } from './ai-provider';
import { GeminiProvider } from './gemini.provider';

// The single place that decides which vendor the app uses.
// Returns null when no key is configured, so AI features can be switched off cleanly.
export function createAiProvider(): AiProvider | null {
  if (!env.GEMINI_API_KEY) return null;
  return new GeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
}

export * from './ai-provider';
