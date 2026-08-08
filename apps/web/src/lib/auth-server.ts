import { cookies } from 'next/headers';
import { apiClient, ApiError } from '@/lib/api-client';
import type { PublicUser } from '@/lib/types';

export async function getInitialUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;

  try {
    const { user } = await apiClient.get<{ user: PublicUser }>('/api/auth/me', {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    });
    return user;
  } catch (err) {
    if (err instanceof ApiError) return null;
    throw err;
  }
}
