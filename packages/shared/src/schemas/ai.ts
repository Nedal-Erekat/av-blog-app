import { z } from 'zod';

// What the web app sends to POST /api/ai/summarize.
// The content cap is a cost guardrail: every character we send to the model costs tokens.
export const SummarizePostInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(20, 'Write a bit more content before asking for a summary').max(20_000),
});
export type SummarizePostInput = z.infer<typeof SummarizePostInputSchema>;

// What we expect back from the model. The model is asked for exactly this shape, but we
// never trust that: its output is validated against this schema before we use it.
export const PostSuggestionSchema = z.object({
  excerpt: z.string().min(1).max(300),
  category: z.string().min(1).max(50),
});
export type PostSuggestion = z.infer<typeof PostSuggestionSchema>;
