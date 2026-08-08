import type { CreatePostInput, UpdatePostInput } from '@av-blog/shared';
import { ForbiddenError, NotFoundError } from '../errors';
import { categoryRepository } from '../repositories/category.repository';
import { postRepository, type PostRepository } from '../repositories/post.repository';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveExcerpt(content: string): string {
  const plain = content.replace(/\s+/g, ' ').trim();
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

async function resolveCategoryId(categoryName: string | undefined): Promise<string | undefined> {
  if (!categoryName) return undefined;

  const existing = await categoryRepository.findByName(categoryName);
  if (existing) return existing.id;

  try {
    const created = await categoryRepository.create({ name: categoryName, slug: slugify(categoryName) });
    return created.id;
  } catch {
    // Two requests raced to create the same category; the loser just reads what won.
    const retried = await categoryRepository.findByName(categoryName);
    if (retried) return retried.id;
    throw new Error('Failed to resolve category');
  }
}

export function createPostService(repository: PostRepository = postRepository) {
  return {
    listPosts(filter?: { authorId?: string; categorySlug?: string }) {
      return repository.findMany(filter);
    },

    async getPostBySlug(slug: string) {
      const post = await repository.findBySlug(slug);
      if (!post) throw new NotFoundError('Post not found');
      return post;
    },

    async createPost(authorId: string, input: CreatePostInput) {
      const baseSlug = slugify(input.title);
      let slug = baseSlug;
      let suffix = 1;
      // eslint-disable-next-line no-await-in-loop
      while (await repository.findBySlug(slug)) {
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }

      const categoryId = await resolveCategoryId(input.category);

      return repository.create({
        title: input.title,
        content: input.content,
        excerpt: input.excerpt ?? deriveExcerpt(input.content),
        slug,
        authorId,
        categoryId,
      });
    },

    async updatePost(id: string, userId: string, input: UpdatePostInput) {
      const post = await repository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      if (post.authorId !== userId) throw new ForbiddenError('You can only edit your own posts');

      const categoryId = input.category !== undefined ? await resolveCategoryId(input.category) : undefined;

      return repository.update(id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
      });
    },

    async deletePost(id: string, userId: string): Promise<void> {
      const post = await repository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      if (post.authorId !== userId) throw new ForbiddenError('You can only delete your own posts');
      await repository.delete(id);
    },
  };
}

export const postService = createPostService();
