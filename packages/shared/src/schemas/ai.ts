import { z } from 'zod';
import type { CreatePostInput } from './post';

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

// GET /api/posts/search?q=... A length cap keeps each query cheap to embed.
export const SearchPostsQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search for at least 2 characters').max(200),
});
export type SearchPostsQuery = z.infer<typeof SearchPostsQuerySchema>;

// "semantic" = matched by meaning (embeddings); "keyword" = plain text match, used as a
// fallback when the AI is not configured or unavailable.
export type SearchMode = 'semantic' | 'keyword';

// POST /api/ai/ask — "Ask the blog" (RAG).
export const AskBlogInputSchema = z.object({
  question: z.string().trim().min(3, 'Ask a slightly longer question').max(500),
});
export type AskBlogInput = z.infer<typeof AskBlogInputSchema>;

// What the model must return. `citedSourceIds` refer to the numbered sources we gave it;
// `answerable` is false when the sources don't contain the answer.
export const AskBlogModelOutputSchema = z.object({
  answer: z.string().min(1).max(2000),
  citedSourceIds: z.array(z.number().int()),
  answerable: z.boolean(),
});
export type AskBlogModelOutput = z.infer<typeof AskBlogModelOutputSchema>;

export type AskBlogSource = { postId: string; title: string; slug: string };

export type AskBlogResponse = {
  answer: string;
  // Only the posts the answer actually cites (never ones the model made up).
  sources: AskBlogSource[];
  answerable: boolean;
};

// POST /api/ai/agent/draft — the writing assistant agent.
export const AgentDraftInputSchema = z.object({
  instruction: z
    .string()
    .trim()
    .min(10, 'Describe the post you want in a bit more detail')
    .max(1000),
});
export type AgentDraftInput = z.infer<typeof AgentDraftInputSchema>;

// One thing the agent did, shown to the user so its work is transparent.
export type AgentStep = { tool: string; summary: string; ok: boolean };

export type AgentDraftResponse = {
  // A proposed post for the author to review and edit. The agent never publishes anything.
  draft: CreatePostInput | null;
  message: string;
  steps: AgentStep[];
};
