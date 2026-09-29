import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthConsentForm } from './OAuthConsentForm';
import { ApiError, apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { post: jest.fn() },
}));

const grant = {
  clientName: 'Claude',
  clientUri: null,
  redirectHost: 'claude.ai',
  scopes: ['posts:read', 'posts:write'],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OAuthConsentForm', () => {
  it('explains who is asking, for what, and where the user will return', () => {
    render(<OAuthConsentForm grantId="g1" grant={grant} redirect={jest.fn()} />);

    expect(screen.getByRole('heading', { name: /Claude wants to access/ })).toBeInTheDocument();
    expect(screen.getByText('claude.ai')).toBeInTheDocument();
    expect(screen.getByText('Search and read posts')).toBeInTheDocument();
    expect(screen.getByText(/asked to confirm before anything is published/)).toBeInTheDocument();
  });

  it.each(['approve', 'deny'] as const)('on %s, returns the user to the app', async (decision) => {
    (apiClient.post as jest.Mock).mockResolvedValue({ redirectUrl: 'https://claude.ai/cb?code=x' });
    const redirect = jest.fn();
    const user = userEvent.setup();
    render(<OAuthConsentForm grantId="g1" grant={grant} redirect={redirect} />);

    await user.click(
      screen.getByRole('button', { name: decision === 'approve' ? 'Approve' : 'Deny' }),
    );

    expect(apiClient.post).toHaveBeenCalledWith(`/api/oauth/grants/g1/${decision}`);
    expect(redirect).toHaveBeenCalledWith('https://claude.ai/cb?code=x');
  });

  it('shows the error and stays when the request has expired', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(
      new ApiError('This authorization request is invalid or has expired.', 404),
    );
    const redirect = jest.fn();
    const user = userEvent.setup();
    render(<OAuthConsentForm grantId="g1" grant={grant} redirect={redirect} />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText(/has expired/)).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
