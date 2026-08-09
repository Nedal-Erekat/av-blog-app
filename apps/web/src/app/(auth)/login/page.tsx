'use client';

import { LoginInputSchema } from '@av-blog/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api-client';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const result = LoginInputSchema.safeParse(form);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      await login(result.data);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        No account?
        <Link href="/register" className="underline">
          Register
        </Link>
      </p>
    </main>
  );
}
