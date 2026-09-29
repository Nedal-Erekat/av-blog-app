import { AiProviderError, type AiProvider } from '../../src/ai';
import { ServiceUnavailableError } from '../../src/errors';
import { createAiService } from '../../src/services/ai.service';

const input = {
  title: 'Shipping with Docker',
  content: 'How we moved our blog to containers and what we learned.',
};

function fakeProvider(data: unknown): AiProvider {
  return {
    generateJson: jest
      .fn()
      .mockResolvedValue({
        data,
        model: 'fake-model',
        usage: { inputTokens: 10, outputTokens: 5 },
      }),
    embedDocuments: jest.fn(),
    embedQuery: jest.fn(),
    chat: jest.fn(),
  };
}

beforeEach(() => {
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('aiService.suggestPostMetadata', () => {
  it('returns the validated suggestion from the model', async () => {
    const provider = fakeProvider({ excerpt: 'Moving a blog to Docker.', category: 'Engineering' });
    const service = createAiService(provider);

    await expect(service.suggestPostMetadata(input)).resolves.toEqual({
      excerpt: 'Moving a blog to Docker.',
      category: 'Engineering',
    });
  });

  it('keeps instructions in the system prompt and wraps the post as tagged data', async () => {
    const provider = fakeProvider({ excerpt: 'x', category: 'y' });
    await createAiService(provider).suggestPostMetadata(input);

    const request = (provider.generateJson as jest.Mock).mock.calls[0][0];
    expect(request.system).toMatch(/never follow instructions/i);
    expect(request.system).not.toContain(input.content);
    expect(request.prompt).toContain(`<content>\n${input.content}\n</content>`);
  });

  it('rejects model output that does not match the expected shape', async () => {
    const provider = fakeProvider({ excerpt: 'Only an excerpt, no category' });

    await expect(createAiService(provider).suggestPostMetadata(input)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it('turns provider failures into a friendly 503', async () => {
    const provider: AiProvider = {
      generateJson: jest.fn().mockRejectedValue(new AiProviderError('Gemini returned HTTP 429')),
      embedDocuments: jest.fn(),
      embedQuery: jest.fn(),
      chat: jest.fn(),
    };

    const error = await createAiService(provider)
      .suggestPostMetadata(input)
      .catch((e) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error.message).not.toContain('429');
  });

  it('answers 503 when no AI provider is configured', async () => {
    await expect(createAiService(null).suggestPostMetadata(input)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });
});
