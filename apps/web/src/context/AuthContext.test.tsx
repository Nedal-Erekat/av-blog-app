import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

function Consumer() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <p>loading: {String(loading)}</p>
      <p>user: {user ? user.email : 'none'}</p>
      <button type="button" onClick={() => login({ email: 'a@example.com', password: 'password123' })}>
        Log in
      </button>
      <button type="button" onClick={() => logout()}>
        Log out
      </button>
    </div>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthProvider', () => {
  it('hydrates from /api/auth/me on mount', async () => {
    mockedApiClient.get.mockResolvedValue({ user: { id: '1', email: 'hydrated@example.com', name: 'H' } });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByText('loading: true')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('loading: false')).toBeInTheDocument());
    expect(screen.getByText('user: hydrated@example.com')).toBeInTheDocument();
  });

  it('sets user to null when the session check fails', async () => {
    mockedApiClient.get.mockRejectedValue(new Error('401'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('loading: false')).toBeInTheDocument());
    expect(screen.getByText('user: none')).toBeInTheDocument();
  });

  it('updates user state after a successful login', async () => {
    mockedApiClient.get.mockRejectedValue(new Error('401'));
    mockedApiClient.post.mockResolvedValue({ user: { id: '2', email: 'login@example.com', name: 'L' } });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('loading: false')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('user: login@example.com')).toBeInTheDocument());
    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'a@example.com',
      password: 'password123',
    });
  });

  it('clears user state after logout', async () => {
    mockedApiClient.get.mockResolvedValue({ user: { id: '1', email: 'hydrated@example.com', name: 'H' } });
    mockedApiClient.post.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('user: hydrated@example.com')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(screen.getByText('user: none')).toBeInTheDocument());
  });
});
