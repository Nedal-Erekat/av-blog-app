import {
  BLOG_ACTIONS,
  BlogActionCallSchema,
  type AgentDraftResponse,
  type BlogActionCall,
  type CreatePostInput,
  type SearchMode,
} from '@av-blog/shared';
import { ApiError } from '@/lib/api-client';
import { savePendingDraft } from '@/lib/pending-draft';
import type { Post, SearchResult } from '@/lib/types';

// Runs blog actions in the browser, as the signed-in user. Both the command bar (our own AI)
// and WebMCP (the browser's AI) go through here, so the rules live in ONE place:
// arguments are validated, sign-in is checked, and nothing is published without the user
// confirming.

export type PublishChoice = 'publish' | 'edit' | 'cancel';

export type BlogActionContext = {
  navigate(url: string): void;
  isSignedIn(): boolean;
  // Shows the post to the user and waits for their decision.
  confirmPublish(post: CreatePostInput): Promise<PublishChoice>;
  onPublished(post: Post): Promise<void>;
  api: {
    searchPosts(topic: string): Promise<{ mode: SearchMode; results: SearchResult[] }>;
    draftWithAgent(instruction: string): Promise<AgentDraftResponse>;
    createPost(input: CreatePostInput): Promise<Post>;
  };
};

// JSON-serializable, so it can go straight back to an AI agent.
export type BlogActionResult = { ok: boolean; message: string; data?: unknown };

export function createBlogActionRunner(ctx: BlogActionContext) {
  function prepare(post: CreatePostInput): BlogActionResult {
    savePendingDraft(post);
    ctx.navigate('/posts/new');
    return {
      ok: true,
      message: `Opened the editor with "${post.title}". Review it, then click Publish.`,
    };
  }

  async function publishWithConfirmation(post: CreatePostInput): Promise<BlogActionResult> {
    const choice = await ctx.confirmPublish(post);
    if (choice === 'cancel') return { ok: false, message: 'The user cancelled publishing.' };
    if (choice === 'edit') return prepare(post);

    const created = await ctx.api.createPost(post);
    await ctx.onPublished(created);
    ctx.navigate(`/posts/${created.slug}`);
    return {
      ok: true,
      message: `Published "${created.title}".`,
      data: { slug: created.slug, url: `/posts/${created.slug}` },
    };
  }

  async function execute(call: BlogActionCall): Promise<BlogActionResult> {
    switch (call.name) {
      case 'find_posts': {
        const { mode, results } = await ctx.api.searchPosts(call.args.topic);
        ctx.navigate(`/search?q=${encodeURIComponent(call.args.topic)}`);
        return {
          ok: true,
          message: `Found ${results.length} post${results.length === 1 ? '' : 's'} about "${call.args.topic}".`,
          data: {
            mode,
            posts: results.map(({ post, similarity }) => ({
              title: post.title,
              slug: post.slug,
              excerpt: post.excerpt,
              url: `/posts/${post.slug}`,
              similarity,
            })),
          },
        };
      }
      case 'open_post':
        ctx.navigate(`/posts/${encodeURIComponent(call.args.slug)}`);
        return { ok: true, message: `Opened the post "${call.args.slug}".` };
      case 'prepare_post':
        return prepare(call.args);
      case 'publish_post':
        return publishWithConfirmation(call.args);
      case 'draft_post_with_ai': {
        const response = await ctx.api.draftWithAgent(
          `Write a blog post about: ${call.args.topic}`,
        );
        if (!response.draft) {
          return { ok: false, message: response.message, data: { steps: response.steps } };
        }
        const result =
          call.args.mode === 'publish'
            ? await publishWithConfirmation(response.draft)
            : prepare(response.draft);
        return { ...result, data: { ...(result.data as object), steps: response.steps } };
      }
    }
  }

  return {
    // `name` and `args` may come straight from an AI agent: validate before doing anything.
    async run(name: string, args: unknown): Promise<BlogActionResult> {
      const parsed = BlogActionCallSchema.safeParse({ name, args: args ?? {} });
      if (!parsed.success) {
        const problems = parsed.error.errors.map(
          (e) => `${e.path.slice(1).join('.') || e.path.join('.')}: ${e.message}`,
        );
        return { ok: false, message: `Invalid request for "${name}". ${problems.join('; ')}` };
      }

      const { requiresAuth } = BLOG_ACTIONS.find((action) => action.name === parsed.data.name)!;
      if (requiresAuth && !ctx.isSignedIn()) {
        return { ok: false, message: 'Please sign in first to write or publish posts.' };
      }

      try {
        return await execute(parsed.data);
      } catch (err) {
        return {
          ok: false,
          message:
            err instanceof ApiError ? err.message : 'Something went wrong running that action.',
        };
      }
    },
  };
}

export type BlogActionRunner = ReturnType<typeof createBlogActionRunner>;
