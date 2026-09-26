import 'server-only';

import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { CreatePostInput } from '@av-blog/shared';
import type { OAuthGrantInfo, Post, PublicUser } from '@/lib/types';

/**
 * Data Access Layer.
 *
 * Every authenticated read goes through here, and every one of them calls
 * `verifySession()` before it touches data. Pages and components receive data
 * that has already been authorized — they never inspect the session to decide
 * what to render or whether to redirect.
 */

const readAuthCookie = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get('token')?.value;
  return token ? `token=${token}` : null;
});

/**
 * The signed-in user, or `null`. Never redirects — for UI that is legitimately
 * viewable logged out, such as the navbar and the public post pages.
 */
export const getOptionalUser = cache(async (): Promise<PublicUser | null> => {
  const cookieHeader = await readAuthCookie();
  if (!cookieHeader) return null;

  try {
    const { user } = await apiClient.get<{ user: PublicUser }>('/api/auth/me', {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    return user;
  } catch (err) {
    // A rejected token is "not signed in", not a crash. Anything else is a bug.
    if (err instanceof ApiError) return null;
    throw err;
  }
});

/**
 * A verified session, or a redirect to /login. The token is validated by the
 * API on every call — cookie presence alone is never treated as proof.
 */
export const verifySession = cache(
  async (returnTo?: string): Promise<{ user: PublicUser; cookieHeader: string }> => {
    const [user, cookieHeader] = await Promise.all([getOptionalUser(), readAuthCookie()]);
    if (!user || !cookieHeader) {
      // `returnTo` brings the user back after signing in (e.g. to an OAuth consent page).
      redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login');
    }
    return { user, cookieHeader };
  },
);

/** Posts written by the signed-in user. Requires a session. */
export const getMyPosts = cache(async (): Promise<Post[]> => {
  const { user } = await verifySession();
  const { posts } = await apiClient.get<{ posts: Post[] }>(`/api/posts?authorId=${user.id}`, {
    cache: 'no-store',
  });
  return posts;
});

/**
 * A post the signed-in user is allowed to edit. Requires a session, and sends
 * non-authors back to the post's public page — the ownership rule is applied
 * here, not in the edit page. The API enforces it again on submit.
 *
 * Read uncached, unlike `getPost` in `lib/data.ts`: an edit form must start
 * from the current content, not a copy that may be minutes old.
 */
export const getPostForEdit = cache(async (slug: string): Promise<Post> => {
  const { user } = await verifySession();

  let post: Post;
  try {
    const res = await apiClient.get<{ post: Post }>(`/api/posts/${slug}`, { cache: 'no-store' });
    post = res.post;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  if (post.authorId !== user.id) {
    redirect(`/posts/${slug}`);
  }
  return post;
});

/**
 * Whether the signed-in user authored a post. `false` when logged out.
 *
 * Client components can't import this module, so ownership is resolved here and
 * handed down as a prop rather than re-derived from auth context in the client.
 */
export const isPostAuthor = cache(async (authorId: string): Promise<boolean> => {
  const user = await getOptionalUser();
  return user?.id === authorId;
});

/** Whether the signed-in user has liked a post. `false` when logged out. */
export const getLikeStatus = cache(async (postId: string): Promise<boolean> => {
  const cookieHeader = await readAuthCookie();
  if (!cookieHeader) return false;

  try {
    const { liked } = await apiClient.get<{ liked: boolean }>(`/api/posts/${postId}/like`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    return liked;
  } catch (err) {
    if (err instanceof ApiError) return false;
    throw err;
  }
});

/**
 * A pending "let this AI app access your blog" request, for the consent page. `null` if it
 * doesn't exist, expired, or was already answered.
 */
export async function getOAuthGrant(grantId: string): Promise<OAuthGrantInfo | null> {
  const { cookieHeader } = await verifySession(
    `/oauth/consent?grant=${encodeURIComponent(grantId)}`,
  );
  try {
    return await apiClient.get<OAuthGrantInfo>(`/api/oauth/grants/${encodeURIComponent(grantId)}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** A draft an AI app saved for the signed-in user to review. `null` if missing or expired. */
export async function getDraftHandoff(handoffId: string): Promise<CreatePostInput | null> {
  const { cookieHeader } = await verifySession(
    `/posts/new?handoff=${encodeURIComponent(handoffId)}`,
  );
  try {
    const { draft } = await apiClient.get<{ draft: CreatePostInput }>(
      `/api/draft-handoffs/${encodeURIComponent(handoffId)}`,
      { headers: { Cookie: cookieHeader }, cache: 'no-store' },
    );
    return draft;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
