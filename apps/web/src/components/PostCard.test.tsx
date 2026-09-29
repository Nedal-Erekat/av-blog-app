import { render, screen } from '@testing-library/react';
import { PostCard } from './PostCard';
import type { Post } from '@/lib/types';

const post: Post = {
  id: '1',
  title: 'Hello World',
  slug: 'hello-world',
  content: 'Full content here.',
  excerpt: 'A short excerpt.',
  authorId: 'author-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  category: null,
  _count: { comments: 0, likes: 0 },
};

describe('PostCard', () => {
  it('renders the title, excerpt, and a link to the post', () => {
    render(<PostCard post={post} />);

    const link = screen.getByRole('link', { name: 'Hello World' });
    expect(link).toHaveAttribute('href', '/posts/hello-world');
    expect(screen.getByText('A short excerpt.')).toBeInTheDocument();
  });

  it('shows the match percentage for semantic search results', () => {
    render(<PostCard post={post} similarity={0.873} />);

    expect(screen.getByText(/87% match/)).toBeInTheDocument();
  });

  it('shows no match percentage outside search', () => {
    render(<PostCard post={post} />);

    expect(screen.queryByText(/% match/)).not.toBeInTheDocument();
  });
});
