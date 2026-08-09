'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="bg-indigo-600">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-white">
          Avertra Blog
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-indigo-100">
          {loading ? null : user ? (
            <>
              <Link href="/dashboard" className="hover:text-white">
                My Posts
              </Link>
              <Link href="/posts/new" className="hover:text-white">
                New Post
              </Link>
              <button type="button" onClick={() => logout()} className="hover:text-white">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-white">
                Log in
              </Link>
              <Link href="/register" className="hover:text-white">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
