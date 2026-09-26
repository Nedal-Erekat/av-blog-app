import { BLOG_ACTIONS } from '@av-blog/shared';
import { render } from '@testing-library/react';
import { WebMcpTools } from './WebMcpTools';

const runner = { run: jest.fn().mockResolvedValue({ ok: true, message: 'done' }) };
jest.mock('@/context/BlogActionsContext', () => ({ useBlogActions: () => runner }));

type RegisteredTool = {
  tool: { name: string; execute: (input: unknown) => Promise<unknown>; annotations: object };
  signal: AbortSignal;
};

function installModelContext(on: 'document' | 'navigator') {
  const registered: RegisteredTool[] = [];
  const modelContext = {
    registerTool: jest.fn(
      async (tool: RegisteredTool['tool'], options: { signal: AbortSignal }) => {
        registered.push({ tool, signal: options.signal });
      },
    ),
  };
  Object.defineProperty(on === 'document' ? document : navigator, 'modelContext', {
    value: modelContext,
    configurable: true,
  });
  return registered;
}

afterEach(() => {
  delete (document as unknown as { modelContext?: unknown }).modelContext;
  delete (navigator as unknown as { modelContext?: unknown }).modelContext;
  jest.clearAllMocks();
});

describe('WebMcpTools', () => {
  it('registers every blog action as a WebMCP tool with the right hints', () => {
    const registered = installModelContext('document');

    render(<WebMcpTools />);

    expect(registered.map((r) => r.tool.name)).toEqual(BLOG_ACTIONS.map((a) => a.name));
    const byName = Object.fromEntries(registered.map((r) => [r.tool.name, r.tool]));
    expect(byName.find_posts.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(byName.publish_post.annotations).toEqual({
      readOnlyHint: false,
      untrustedContentHint: false,
    });
  });

  it('runs tool calls through the shared action runner', async () => {
    const registered = installModelContext('document');
    render(<WebMcpTools />);

    const findPosts = registered.find((r) => r.tool.name === 'find_posts')!.tool;
    await expect(findPosts.execute({ topic: 'remote work' })).resolves.toEqual({
      ok: true,
      message: 'done',
    });
    expect(runner.run).toHaveBeenCalledWith('find_posts', { topic: 'remote work' });
  });

  it('unregisters the tools on unmount', () => {
    const registered = installModelContext('document');
    const { unmount } = render(<WebMcpTools />);

    unmount();

    expect(registered.every((r) => r.signal.aborted)).toBe(true);
  });

  it('falls back to the older navigator.modelContext', () => {
    const registered = installModelContext('navigator');

    render(<WebMcpTools />);

    expect(registered).toHaveLength(BLOG_ACTIONS.length);
  });

  it('does nothing in browsers without WebMCP', () => {
    expect(() => render(<WebMcpTools />)).not.toThrow();
  });
});
