'use server';

import { updateTag } from 'next/cache';

export async function revalidatePost(slug: string) {
  updateTag('posts');
  updateTag(`post:${slug}`);
}

export async function revalidatePostsList() {
  updateTag('posts');
}

export async function revalidateComments(postId: string) {
  updateTag(`comments:${postId}`);
}
