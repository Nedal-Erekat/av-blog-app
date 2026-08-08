import { cacheLife, cacheTag } from 'next/cache';
import { apiClient } from '@/lib/api-client';
import type { Category, Comment, Post } from '@/lib/types';

export async function getPosts(category?: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('posts');
  const query = category ? `?category=${category}` : '';
  const { posts } = await apiClient.get<{ posts: Post[] }>(`/api/posts${query}`);
  return posts;
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
