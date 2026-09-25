import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentDraftPanel } from './AgentDraftPanel';
import { ApiError, apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { post: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

async function requestDraft(instruction: string, onDraft = jest.fn()) {
  const user = userEvent.setup();
  render(<AgentDraftPanel onDraft={onDraft} />);
  await user.type(screen.getByRole('textbox', { name: /describe the post/ }), instruction);
  await user.click(screen.getByRole('button', { name: 'Draft it for me' }));
  return onDraft;
}

describe('AgentDraftPanel', () => {
  it('hands the draft to the form and shows the steps the agent took', async () => {
    const draft = { title: 'Postgres, a year later', content: 'Body', category: 'Engineering' };
    (apiClient.post as jest.Mock).mockResolvedValue({
      draft,
      message: 'Here is a draft. Review and edit it before publishing.',
      steps: [
        { tool: 'search_posts', summary: 'Searched posts for "postgres"', ok: true },
        { tool: 'propose_draft', summary: 'Proposed a draft: "Postgres, a year later"', ok: true },
      ],
    });

    const onDraft = await requestDraft('A follow-up to the Postgres post');

    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/agent/draft', {
      instruction: 'A follow-up to the Postgres post',
    });
    expect(await screen.findByText(/Review and edit it/)).toBeInTheDocument();
    expect(screen.getByText('Searched posts for "postgres"')).toBeInTheDocument();
    expect(onDraft).toHaveBeenCalledWith(draft);
  });

  it('shows the message and does not touch the form when there is no draft', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      draft: null,
      message: 'The assistant stopped after 8 steps without finishing a draft.',
      steps: [],
    });

    const onDraft = await requestDraft('Something vague about stuff');

    expect(await screen.findByText(/stopped after 8 steps/)).toBeInTheDocument();
    expect(onDraft).not.toHaveBeenCalled();
  });

  it('validates the instruction before calling the API', async () => {
    await requestDraft('short');

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(await screen.findByText(/a bit more detail/)).toBeInTheDocument();
  });

  it('shows rate-limit and outage errors from the API', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(
      new ApiError("You've reached the limit for AI requests. Try again in 40 minutes.", 429),
    );

    await requestDraft('A post about our remote culture');

    expect(await screen.findByText(/reached the limit/)).toBeInTheDocument();
  });
});
