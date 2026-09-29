import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandBar } from './CommandBar';
import { ApiError, apiClient } from '@/lib/api-client';

const runner = { run: jest.fn() };
jest.mock('@/context/BlogActionsContext', () => ({ useBlogActions: () => runner }));
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { post: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

async function command(text: string) {
  const user = userEvent.setup();
  render(<CommandBar />);
  await user.keyboard('{Control>}k{/Control}');
  await user.type(screen.getByLabelText('What do you want to do?'), text);
  await user.click(screen.getByRole('button', { name: 'Go' }));
}

describe('CommandBar', () => {
  it('opens with Ctrl+K, asks the API for an action, and runs it in the browser', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      action: { name: 'find_posts', args: { topic: 'remote work' } },
      message: '',
    });
    runner.run.mockResolvedValue({ ok: true, message: 'Found 2 posts' });

    await command('show me posts about remote work');

    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/command', {
      text: 'show me posts about remote work',
    });
    expect(runner.run).toHaveBeenCalledWith('find_posts', { topic: 'remote work' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the message when no action fits', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      action: null,
      message: 'I can find posts or write a new one.',
    });

    await command('what is the weather?');

    expect(await screen.findByText('I can find posts or write a new one.')).toBeInTheDocument();
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('keeps the bar open and shows why an action failed', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      action: { name: 'publish_post', args: { title: 'T', content: 'C' } },
      message: '',
    });
    runner.run.mockResolvedValue({ ok: false, message: 'The user cancelled publishing.' });

    await command('publish a post called T');

    expect(await screen.findByText('The user cancelled publishing.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows API errors such as rate limits', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(
      new ApiError("You've reached the limit for AI requests. Try again in 5 minutes.", 429),
    );

    await command('find posts about design');

    expect(await screen.findByText(/reached the limit/)).toBeInTheDocument();
  });
});
