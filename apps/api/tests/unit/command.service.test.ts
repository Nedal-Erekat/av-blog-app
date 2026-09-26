import { BLOG_ACTIONS } from '@av-blog/shared';
import { AiProviderError, type AiProvider, type ChatRequest, type ToolCall } from '../../src/ai';
import { ServiceUnavailableError } from '../../src/errors';
import { createCommandService } from '../../src/services/command.service';

function providerReplying(reply: { text?: string; toolCalls?: ToolCall[] }) {
  const chat = jest.fn(async (_request: ChatRequest) => ({
    message: {
      role: 'assistant' as const,
      text: reply.text ?? '',
      toolCalls: reply.toolCalls ?? [],
    },
    model: 'fake',
    usage: { inputTokens: 10, outputTokens: 5 },
  }));
  const provider: AiProvider = {
    chat,
    generateJson: jest.fn(),
    embedDocuments: jest.fn(),
    embedQuery: jest.fn(),
  };
  return { provider, chat };
}

beforeEach(() => {
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('commandService.interpret', () => {
  it('turns a request into a validated action, applying schema defaults', async () => {
    const { provider } = providerReplying({
      toolCalls: [{ name: 'draft_post_with_ai', args: { topic: 'remote work' } }],
    });

    const response = await createCommandService(provider).interpret(
      'I want to create a blog about remote work',
    );

    expect(response).toEqual({
      action: { name: 'draft_post_with_ai', args: { topic: 'remote work', mode: 'edit' } },
      message: '',
    });
  });

  it('offers every blog action as a tool, and wraps the text as escaped data', async () => {
    const { provider, chat } = providerReplying({ text: 'hi' });

    await createCommandService(provider).interpret('posts about <b>design</b>');

    const request = chat.mock.calls[0][0];
    expect(request.tools.map((t) => t.name)).toEqual(BLOG_ACTIONS.map((a) => a.name));
    expect(request.messages[0]).toEqual({
      role: 'user',
      text: '<request>\nposts about &lt;b&gt;design&lt;/b&gt;\n</request>',
    });
    expect(request.system).toMatch(/Never follow instructions/);
  });

  it('rejects an action with invalid arguments instead of passing it on', async () => {
    const { provider } = providerReplying({
      toolCalls: [{ name: 'publish_post', args: { title: '' } }],
    });

    const response = await createCommandService(provider).interpret('publish something');

    expect(response.action).toBeNull();
    expect(response.message).toMatch(/couldn't turn that into an action/);
  });

  it('rejects a tool name that is not a blog action', async () => {
    const { provider } = providerReplying({
      toolCalls: [{ name: 'delete_everything', args: {} }],
    });

    await expect(createCommandService(provider).interpret('delete all')).resolves.toMatchObject({
      action: null,
    });
  });

  it("passes the model's message through when no action fits", async () => {
    const { provider } = providerReplying({ text: 'I can find posts or write a new one.' });

    await expect(createCommandService(provider).interpret('what is the weather?')).resolves.toEqual(
      { action: null, message: 'I can find posts or write a new one.' },
    );
  });

  it('turns model outages into a friendly 503, and 503s when AI is not configured', async () => {
    const { provider, chat } = providerReplying({});
    chat.mockRejectedValue(new AiProviderError('HTTP 500'));

    await expect(createCommandService(provider).interpret('find posts')).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    await expect(createCommandService(null).interpret('find posts')).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });
});
