'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="border-b border-gray-200">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Avertra Blog
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {loading ? null : user ? (
            <>
              <Link href="/dashboard">My Posts</Link>
              <Link href="/posts/new">New Post</Link>
              <button type="button" onClick={() => logout()} className="text-gray-600 hover:text-gray-900">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
