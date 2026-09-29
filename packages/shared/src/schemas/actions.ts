import { z } from 'zod';
import { CreatePostInputSchema } from './post';

// The "blog actions": one list of things an AI may do on the site, shared by every entry point
// (the in-app command bar, WebMCP browser agents, and later a remote MCP server). Each action has:
// - a JSON schema, which is what the AI sees
// - a zod schema, which is what we validate against (never trust AI-produced arguments)
// - hints, which tell agents whether it only reads or also changes things

export const FindPostsArgsSchema = z.object({
  topic: z.string().trim().min(2).max(200),
});

export const OpenPostArgsSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

export const PreparePostArgsSchema = CreatePostInputSchema;

export const DraftPostWithAiArgsSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  // 'edit': open the editor pre-filled. 'publish': show the draft for confirmation, then publish.
  mode: z.enum(['edit', 'publish']).default('edit'),
});

export const PublishPostArgsSchema = CreatePostInputSchema;

const postFieldsJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Post title, at most 200 characters.' },
    content: {
      type: 'string',
      description: 'Full post text, paragraphs separated by blank lines.',
    },
    excerpt: {
      type: 'string',
      description: 'Optional 1-2 sentence teaser, at most 300 characters.',
    },
    category: { type: 'string', description: 'Optional category name, e.g. "Engineering".' },
  },
  required: ['title', 'content'],
} as const;

export const BLOG_ACTIONS = [
  {
    name: 'find_posts',
    description:
      'Find blog posts about a topic (search by meaning). Shows the results page to the user and returns the matching posts.',
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string', description: 'What the posts should be about.' } },
      required: ['topic'],
    },
    readOnly: true,
    requiresAuth: false,
  },
  {
    name: 'open_post',
    description: 'Open one blog post by its slug (from find_posts).',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The post slug.' } },
      required: ['slug'],
    },
    readOnly: true,
    requiresAuth: false,
  },
  {
    name: 'draft_post_with_ai',
    description:
      "Write a new post about a topic using the blog's own writing assistant, which researches existing posts first. mode 'edit' (default) opens the editor pre-filled for the user to review; mode 'publish' asks the user to confirm, then publishes.",
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'What the new post should be about.' },
        mode: {
          type: 'string',
          enum: ['edit', 'publish'],
          description:
            "'edit' to review in the editor first (default), 'publish' to publish after confirmation.",
        },
      },
      required: ['topic'],
    },
    readOnly: false,
    requiresAuth: true,
  },
  {
    name: 'prepare_post',
    description:
      'Open the New Post editor pre-filled with the given post, for the user to review and publish. Nothing is saved.',
    inputSchema: postFieldsJsonSchema,
    readOnly: false,
    requiresAuth: true,
  },
  {
    name: 'publish_post',
    description:
      'Publish a new post. The user is always shown the post and must confirm first; they can also choose to edit it instead.',
    inputSchema: postFieldsJsonSchema,
    readOnly: false,
    requiresAuth: true,
  },
] as const;

export type BlogActionName = (typeof BLOG_ACTIONS)[number]['name'];

// A validated request to run one action.
export const BlogActionCallSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('find_posts'), args: FindPostsArgsSchema }),
  z.object({ name: z.literal('open_post'), args: OpenPostArgsSchema }),
  z.object({ name: z.literal('draft_post_with_ai'), args: DraftPostWithAiArgsSchema }),
  z.object({ name: z.literal('prepare_post'), args: PreparePostArgsSchema }),
  z.object({ name: z.literal('publish_post'), args: PublishPostArgsSchema }),
]);
export type BlogActionCall = z.infer<typeof BlogActionCallSchema>;

// POST /api/ai/command: the command bar sends what the user typed; the API returns which action
// to run. The browser runs it, as the signed-in user, with confirmation for publishing.
export const CommandInputSchema = z.object({
  text: z.string().trim().min(3, 'Tell me a bit more').max(500),
});
export type CommandInput = z.infer<typeof CommandInputSchema>;

export type CommandResponse = {
  action: BlogActionCall | null;
  // Shown when no action fits, e.g. "I can find posts or write a new one."
  message: string;
};
