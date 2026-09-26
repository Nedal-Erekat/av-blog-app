import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlogActionsProvider, useBlogActions } from './BlogActionsContext';
import { apiClient } from '@/lib/api-client';
import type { BlogActionResult } from '@/lib/blog-actions';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('@/lib/actions', () => ({ revalidatePostsList: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const draft = {
  title: 'Remote-first, four years in',
  content: 'Still remote.\n\nStill writing things down.',
};

// Plays the part of an AI agent: calls publish_post and records the result.
function AgentButton({ onResult }: { onResult: (r: BlogActionResult) => void }) {
  const runner = useBlogActions();
  return (
    <button type="button" onClick={async () => onResult(await runner.run('publish_post', draft))}>
      agent publishes
    </button>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

async function agentAsksToPublish() {
  const onResult = jest.fn();
  const user = userEvent.setup();
  render(
    <BlogActionsProvider>
      <AgentButton onResult={onResult} />
    </BlogActionsProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'agent publishes' }));
  return { user, onResult };
}

describe('BlogActionsProvider publish confirmation', () => {
  it('shows the post in a dialog and publishes only after the user clicks Publish', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      post: { title: draft.title, slug: 'remote' },
    });
    const { user, onResult } = await agentAsksToPublish();

    const dialog = await screen.findByRole('dialog', { name: /wants to publish/ });
    expect(dialog).toHaveTextContent(draft.title);
    expect(apiClient.post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts', draft);
    expect(push).toHaveBeenCalledWith('/posts/remote');
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('publishes nothing when the user presses Escape', async () => {
    const { user, onResult } = await agentAsksToPublish();
    await screen.findByRole('dialog');

    await act(() => user.keyboard('{Escape}'));

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith({ ok: false, message: 'The user cancelled publishing.' });
  });
});
