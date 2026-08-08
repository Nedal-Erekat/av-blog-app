import { cache } from 'react';
import { cookies } from 'next/headers';
import { apiClient, ApiError } from '@/lib/api-client';
import type { PublicUser } from '@/lib/types';

export const getAuthCookieHeader = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  return token ? `token=${token}` : null;
});

export const getInitialUser = cache(async (): Promise<PublicUser | null> => {
  const cookieHeader = await getAuthCookieHeader();
  if (!cookieHeader) return null;

  try {
    const { user } = await apiClient.get<{ user: PublicUser }>('/api/auth/me', {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    return user;
  } catch (err) {
    if (err instanceof ApiError) return null;
    throw err;
  }
});
