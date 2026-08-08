import { render, screen } from '@testing-library/react';
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
  it('lists existing comments and hides the form when logged out', () => {
    mockedUseAuth.mockReturnValue({ user: null });
    const initialComments = [
      {
        id: 'c1',
        content: 'First!',
        postId: 'p1',
        authorId: 'u1',
        createdAt: '2026-01-01T00:00:00.000Z',
        author: { id: 'u1', name: 'Alice' },
      },
    ];

    render(<CommentSection postId="p1" initialComments={initialComments} />);

    expect(screen.getByText('First!')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add a comment...')).not.toBeInTheDocument();
  });

  it('lets a logged-in user post a comment, which appears in the list', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u2' } });
    mockedApiClient.post.mockResolvedValue({
      comment: { id: 'c2', content: 'Nice post!', authorId: 'u2', author: { id: 'u2', name: 'Bob' } },
    });
    const user = userEvent.setup();

    render(<CommentSection postId="p1" initialComments={[]} />);

    await user.type(screen.getByPlaceholderText('Add a comment...'), 'Nice post!');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(await screen.findByText('Nice post!')).toBeInTheDocument();
    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/posts/p1/comments', { content: 'Nice post!' });
  });

  it('only shows a delete control for the current user\'s own comments', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u2' } });
    const initialComments = [
      {
        id: 'c1',
        content: 'Not mine',
        postId: 'p1',
        authorId: 'u1',
        createdAt: '2026-01-01T00:00:00.000Z',
        author: { id: 'u1', name: 'Alice' },
      },
      {
        id: 'c2',
        content: 'Mine',
        postId: 'p1',
        authorId: 'u2',
        createdAt: '2026-01-01T00:00:00.000Z',
        author: { id: 'u2', name: 'Bob' },
      },
    ];

    render(<CommentSection postId="p1" initialComments={initialComments} />);

    screen.getByText('Mine');
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });
});
