import type { CreatePostInput, UpdatePostInput } from '@av-blog/shared';
import { ForbiddenError, NotFoundError } from '../errors';
import { postRepository, type PostRepository } from '../repositories/post.repository';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveExcerpt(content: string): string {
  const plain = content.replace(/\s+/g, ' ').trim();
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

export function createPostService(repository: PostRepository = postRepository) {
  return {
    listPosts(filter?: { authorId?: string }) {
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

      return repository.create({
        title: input.title,
        content: input.content,
        excerpt: input.excerpt ?? deriveExcerpt(input.content),
        slug,
        authorId,
      });
    },

    async updatePost(id: string, userId: string, input: UpdatePostInput) {
      const post = await repository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      if (post.authorId !== userId) throw new ForbiddenError('You can only edit your own posts');

      return repository.update(id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
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
