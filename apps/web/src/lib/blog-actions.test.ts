import { ApiError } from '@/lib/api-client';
import { createBlogActionRunner, type BlogActionContext } from '@/lib/blog-actions';
import { takePendingDraft } from '@/lib/pending-draft';
import type { Post } from '@/lib/types';

const draft = {
  title: 'Design tokens, two years in',
  content: 'We moved to design tokens.\n\nHere is what changed.',
  category: 'Design',
};

const createdPost = { id: 'p1', title: draft.title, slug: 'design-tokens-two-years-in' } as Post;

function fakeContext(overrides: Partial<BlogActionContext> = {}) {
  const ctx = {
    navigate: jest.fn(),
    isSignedIn: jest.fn(() => true),
    confirmPublish: jest.fn().mockResolvedValue('publish'),
    onPublished: jest.fn().mockResolvedValue(undefined),
    api: {
      searchPosts: jest.fn().mockResolvedValue({
        mode: 'semantic',
        results: [
          {
            post: { title: 'A Practical Guide to Design Tokens', slug: 'tokens', excerpt: 'Why.' },
            similarity: 0.82,
          },
        ],
      }),
      draftWithAgent: jest.fn().mockResolvedValue({
        draft,
        message: 'Here is a draft.',
        steps: [{ tool: 'search_posts', summary: 'Searched posts for "tokens"', ok: true }],
      }),
      createPost: jest.fn().mockResolvedValue(createdPost),
    },
  };
  // Keep the fake's own (jest.Mock) types so tests can still call mockResolvedValue on it.
  return Object.assign(ctx, overrides) as typeof ctx;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('blog action runner', () => {
  it('find_posts shows the results page and returns the posts', async () => {
    const ctx = fakeContext();

    const result = await createBlogActionRunner(ctx).run('find_posts', { topic: 'design tokens' });

    expect(ctx.navigate).toHaveBeenCalledWith('/search?q=design%20tokens');
    expect(result).toEqual({
      ok: true,
      message: 'Found 1 post about "design tokens".',
      data: {
        mode: 'semantic',
        posts: [
          {
            title: 'A Practical Guide to Design Tokens',
            slug: 'tokens',
            excerpt: 'Why.',
            url: '/posts/tokens',
            similarity: 0.82,
          },
        ],
      },
    });
  });

  it('find_posts works for signed-out visitors', async () => {
    const ctx = fakeContext({ isSignedIn: () => false });

    await expect(
      createBlogActionRunner(ctx).run('find_posts', { topic: 'remote' }),
    ).resolves.toMatchObject({
      ok: true,
    });
  });

  it('prepare_post hands the draft to the editor without saving anything', async () => {
    const ctx = fakeContext();

    const result = await createBlogActionRunner(ctx).run('prepare_post', draft);

    expect(result.ok).toBe(true);
    expect(ctx.navigate).toHaveBeenCalledWith('/posts/new');
    expect(takePendingDraft()).toEqual(draft);
    expect(ctx.api.createPost).not.toHaveBeenCalled();
  });

  it('draft_post_with_ai (edit mode) runs the agent, then opens the editor pre-filled', async () => {
    const ctx = fakeContext();

    const result = await createBlogActionRunner(ctx).run('draft_post_with_ai', {
      topic: 'design tokens',
    });

    expect(ctx.api.draftWithAgent).toHaveBeenCalledWith('Write a blog post about: design tokens');
    expect(ctx.navigate).toHaveBeenCalledWith('/posts/new');
    expect(takePendingDraft()).toEqual(draft);
    expect(ctx.confirmPublish).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({
      steps: [expect.objectContaining({ tool: 'search_posts' })],
    });
  });

  it('draft_post_with_ai reports the agent message when it could not draft', async () => {
    const ctx = fakeContext();
    ctx.api.draftWithAgent.mockResolvedValue({
      draft: null,
      message: 'Stopped after 8 steps.',
      steps: [],
    });

    await expect(
      createBlogActionRunner(ctx).run('draft_post_with_ai', { topic: 'anything' }),
    ).resolves.toMatchObject({ ok: false, message: 'Stopped after 8 steps.' });
  });

  describe('publishing always needs the user to confirm', () => {
    it('publishes only after the user clicks Publish', async () => {
      const ctx = fakeContext();

      const result = await createBlogActionRunner(ctx).run('publish_post', draft);

      expect(ctx.confirmPublish).toHaveBeenCalledWith(draft);
      expect(ctx.api.createPost).toHaveBeenCalledWith(draft);
      expect(ctx.onPublished).toHaveBeenCalledWith(createdPost);
      expect(ctx.navigate).toHaveBeenCalledWith('/posts/design-tokens-two-years-in');
      expect(result).toMatchObject({ ok: true, message: `Published "${draft.title}".` });
    });

    it('publishes nothing when the user cancels', async () => {
      const ctx = fakeContext({ confirmPublish: jest.fn().mockResolvedValue('cancel') });

      const result = await createBlogActionRunner(ctx).run('publish_post', draft);

      expect(ctx.api.createPost).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, message: 'The user cancelled publishing.' });
    });

    it('opens the editor instead when the user chooses "Edit first"', async () => {
      const ctx = fakeContext({ confirmPublish: jest.fn().mockResolvedValue('edit') });

      await createBlogActionRunner(ctx).run('publish_post', draft);

      expect(ctx.api.createPost).not.toHaveBeenCalled();
      expect(takePendingDraft()).toEqual(draft);
    });

    it('draft_post_with_ai in publish mode also goes through the confirmation', async () => {
      const ctx = fakeContext();

      await createBlogActionRunner(ctx).run('draft_post_with_ai', {
        topic: 'tokens',
        mode: 'publish',
      });

      expect(ctx.confirmPublish).toHaveBeenCalledWith(draft);
      expect(ctx.api.createPost).toHaveBeenCalled();
    });
  });

  it('refuses write actions for signed-out users', async () => {
    const ctx = fakeContext({ isSignedIn: () => false });
    const runner = createBlogActionRunner(ctx);

    for (const [name, args] of [
      ['prepare_post', draft],
      ['publish_post', draft],
      ['draft_post_with_ai', { topic: 'tokens' }],
    ] as const) {
      await expect(runner.run(name, args)).resolves.toEqual({
        ok: false,
        message: 'Please sign in first to write or publish posts.',
      });
    }
    expect(ctx.confirmPublish).not.toHaveBeenCalled();
  });

  it('validates arguments from the AI before doing anything', async () => {
    const ctx = fakeContext();
    const runner = createBlogActionRunner(ctx);

    const badArgs = await runner.run('publish_post', { title: '' });
    const unknown = await runner.run('delete_all_posts', {});

    expect(badArgs).toMatchObject({
      ok: false,
      message: expect.stringMatching(/^Invalid request for "publish_post"/),
    });
    expect(unknown).toMatchObject({ ok: false });
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.confirmPublish).not.toHaveBeenCalled();
  });

  it('returns API errors as a failed result instead of throwing', async () => {
    const ctx = fakeContext();
    ctx.api.createPost.mockRejectedValue(new ApiError('Title is required', 400));

    await expect(createBlogActionRunner(ctx).run('publish_post', draft)).resolves.toEqual({
      ok: false,
      message: 'Title is required',
    });
  });
});
