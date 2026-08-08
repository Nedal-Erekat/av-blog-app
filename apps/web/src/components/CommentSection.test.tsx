import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentSection } from './CommentSection';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
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

describe('CommentSection', () => {
  it('lists existing comments and hides the form when logged out', async () => {
    mockedUseAuth.mockReturnValue({ user: null });
    mockedApiClient.get.mockResolvedValue({
      comments: [{ id: 'c1', content: 'First!', authorId: 'u1', author: { id: 'u1', name: 'Alice' } }],
    });

    render(<CommentSection postId="p1" />);

    expect(await screen.findByText('First!')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add a comment...')).not.toBeInTheDocument();
  });

  it('lets a logged-in user post a comment, which appears in the list', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u2' } });
    mockedApiClient.get.mockResolvedValue({ comments: [] });
    mockedApiClient.post.mockResolvedValue({
      comment: { id: 'c2', content: 'Nice post!', authorId: 'u2', author: { id: 'u2', name: 'Bob' } },
    });
    const user = userEvent.setup();

    render(<CommentSection postId="p1" />);
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('Add a comment...'), 'Nice post!');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(await screen.findByText('Nice post!')).toBeInTheDocument();
    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/posts/p1/comments', { content: 'Nice post!' });
  });

  it('only shows a delete control for the current user\'s own comments', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u2' } });
    mockedApiClient.get.mockResolvedValue({
      comments: [
        { id: 'c1', content: 'Not mine', authorId: 'u1', author: { id: 'u1', name: 'Alice' } },
        { id: 'c2', content: 'Mine', authorId: 'u2', author: { id: 'u2', name: 'Bob' } },
      ],
    });

    render(<CommentSection postId="p1" />);

    await screen.findByText('Mine');
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });
});
