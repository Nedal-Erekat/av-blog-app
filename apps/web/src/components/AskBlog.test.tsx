import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskBlog } from './AskBlog';
import { ApiError, apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { post: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

async function ask(question: string) {
  const user = userEvent.setup();
  render(<AskBlog />);
  await user.type(screen.getByLabelText('Your question'), question);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
}

describe('AskBlog', () => {
  it('shows the answer with links to the cited posts', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      answer: 'For transactions and foreign keys.',
      sources: [{ postId: 'p1', title: 'Why We Chose Postgres', slug: 'why-postgres' }],
      answerable: true,
    });

    await ask('Why Postgres?');

    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/ask', { question: 'Why Postgres?' });
    expect(await screen.findByText('For transactions and foreign keys.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Why We Chose Postgres' })).toHaveAttribute(
      'href',
      '/posts/why-postgres',
    );
  });

  it('shows an honest "not covered" answer without sources', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      answer: "I couldn't find anything about that in the blog.",
      sources: [],
      answerable: false,
    });

    await ask('Best cake recipe?');

    expect(await screen.findByText(/couldn't find anything/)).toBeInTheDocument();
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });

  it('does not call the API for a too-short question', async () => {
    await ask('hi');

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(await screen.findByText(/slightly longer question/)).toBeInTheDocument();
  });

  it('shows the API error when the AI is unavailable', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(
      new ApiError('The AI assistant is unavailable right now. Please try again later.', 503),
    );

    await ask('Why Postgres?');

    expect(await screen.findByText(/AI assistant is unavailable/)).toBeInTheDocument();
  });
});
