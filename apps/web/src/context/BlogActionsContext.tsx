'use client';

import type { AgentDraftResponse, CreatePostInput, SearchMode } from '@av-blog/shared';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConfirmPublishDialog } from '@/components/ConfirmPublishDialog';
import { useAuth } from '@/context/AuthContext';
import { revalidatePostsList } from '@/lib/actions';
import { apiClient } from '@/lib/api-client';
import {
  createBlogActionRunner,
  type BlogActionRunner,
  type PublishChoice,
} from '@/lib/blog-actions';
import type { Post, SearchResult } from '@/lib/types';

const BlogActionsContext = createContext<BlogActionRunner | undefined>(undefined);

// Wires the action runner to this app: Next.js navigation, the signed-in user, the API, and the
// confirmation dialog.
export function BlogActionsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [pending, setPending] = useState<{
    post: CreatePostInput;
    resolve: (choice: PublishChoice) => void;
  } | null>(null);

  // The runner is created once, but must always see the CURRENT user and router.
  const latest = useRef({ router, user });
  useEffect(() => {
    latest.current = { router, user };
  }, [router, user]);

  const runner = useMemo(
    () =>
      createBlogActionRunner({
        navigate: (url) => latest.current.router.push(url),
        isSignedIn: () => latest.current.user !== null,
        confirmPublish: (post) => new Promise((resolve) => setPending({ post, resolve })),
        onPublished: () => revalidatePostsList(),
        api: {
          searchPosts: (topic) =>
            apiClient.get<{ mode: SearchMode; results: SearchResult[] }>(
              `/api/posts/search?${new URLSearchParams({ q: topic })}`,
            ),
          draftWithAgent: (instruction) =>
            apiClient.post<AgentDraftResponse>('/api/ai/agent/draft', { instruction }),
          createPost: async (input) =>
            (await apiClient.post<{ post: Post }>('/api/posts', input)).post,
        },
      }),
    [],
  );

  return (
    <BlogActionsContext.Provider value={runner}>
      {children}
      {pending && (
        <ConfirmPublishDialog
          post={pending.post}
          onChoose={(choice) => {
            pending.resolve(choice);
            setPending(null);
          }}
        />
      )}
    </BlogActionsContext.Provider>
  );
}

export function useBlogActions(): BlogActionRunner {
  const runner = useContext(BlogActionsContext);
  if (!runner) throw new Error('useBlogActions must be used inside BlogActionsProvider');
  return runner;
}
