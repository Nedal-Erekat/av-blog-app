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
};

describe('PostCard', () => {
  it('renders the title, excerpt, and a link to the post', () => {
    render(<PostCard post={post} />);

    const link = screen.getByRole('link', { name: 'Hello World' });
    expect(link).toHaveAttribute('href', '/posts/hello-world');
    expect(screen.getByText('A short excerpt.')).toBeInTheDocument();
  });
});
