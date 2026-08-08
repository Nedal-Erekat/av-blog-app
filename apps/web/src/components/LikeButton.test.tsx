import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LikeButton } from './LikeButton';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LikeButton', () => {
  it('is disabled and shows the initial count when logged out', () => {
    mockedUseAuth.mockReturnValue({ user: null });

    render(<LikeButton postId="p1" initialCount={3} initialLiked={false} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('3');
  });

  it('optimistically increments the count on click, then reconciles with the server response', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1' } });
    mockedApiClient.post.mockResolvedValue({ liked: true, likeCount: 6 });
    const user = userEvent.setup();

    render(<LikeButton postId="p1" initialCount={5} initialLiked={false} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('6'));
    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/posts/p1/like');
  });

  it('rolls back the optimistic update if the toggle request fails', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1' } });
    mockedApiClient.post.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();

    render(<LikeButton postId="p1" initialCount={5} initialLiked={false} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('5'));
  });
});
