import { cacheLife, cacheTag } from 'next/cache';
import { apiClient } from '@/lib/api-client';
import type { Category, Comment, Pagination, Post } from '@/lib/types';

export async function getPosts(category?: string, page?: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag('posts');
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (page) params.set('page', String(page));
  const query = params.toString() ? `?${params.toString()}` : '';
  const { posts, pagination } = await apiClient.get<{ posts: Post[]; pagination: Pagination }>(
    `/api/posts${query}`,
  );
  return { posts, pagination };
}

export async function getCategories() {
  'use cache';
  cacheLife('hours');
  cacheTag('categories');
  const { categories } = await apiClient.get<{ categories: Category[] }>('/api/categories');
  return categories;
}

export async function getPost(slug: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`post:${slug}`);
  const { post } = await apiClient.get<{ post: Post }>(`/api/posts/${slug}`);
  return post;
}

export async function getComments(postId: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`comments:${postId}`);
  const { comments } = await apiClient.get<{ comments: Comment[] }>(`/api/posts/${postId}/comments`);
  return comments;
}
