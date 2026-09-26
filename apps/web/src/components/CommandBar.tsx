'use client';

import { CommandInputSchema, type CommandResponse } from '@av-blog/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useBlogActions } from '@/context/BlogActionsContext';
import { ApiError, apiClient } from '@/lib/api-client';

// "✨ What do you want to do?" Type a request in plain words; our AI picks a blog action and
// the browser runs it. Opens with the button or Ctrl/Cmd+K.
export function CommandBar() {
  const runner = useBlogActions();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);

    const parsed = CommandInputSchema.safeParse({ text });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid request');
      return;
    }

    setWorking(true);
    try {
      setStatus('Thinking...');
      const { action, message } = await apiClient.post<CommandResponse>(
        '/api/ai/command',
        parsed.data,
      );
      if (!action) {
        setStatus(message);
        return;
      }
      if (action.name === 'draft_post_with_ai')
        setStatus('Researching the blog and writing a draft...');
      const result = await runner.run(action.name, action.args);
      if (result.ok) {
        setText('');
        setStatus(null);
        setOpen(false);
      } else {
        setStatus(null);
        setError(result.message);
      }
    } catch (err) {
      setStatus(null);
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-indigo-500 px-2 py-1 text-white hover:bg-indigo-400"
        title="Ctrl+K"
      >
        ✨ Ask AI
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-4 pt-24"
          onClick={() => !working && setOpen(false)}
        >
          <form
            role="dialog"
            aria-label="AI command bar"
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded bg-white p-4 text-gray-900 shadow-lg"
          >
            <label htmlFor="command" className="block text-sm font-medium">
              What do you want to do?
            </label>
            <div className="mt-2 flex gap-2">
              <input
                ref={inputRef}
                id="command"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={working}
                placeholder='e.g. "posts about remote work" or "write a blog about design tokens"'
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
              <button
                type="submit"
                disabled={working}
                className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
              >
                Go
              </button>
            </div>
            {status && <p className="mt-3 text-sm text-gray-600">{status}</p>}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </form>
        </div>
      )}
    </>
  );
}
