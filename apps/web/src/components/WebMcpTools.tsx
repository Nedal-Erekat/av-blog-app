'use client';

import { BLOG_ACTIONS } from '@av-blog/shared';
import { useEffect } from 'react';
import { useBlogActions } from '@/context/BlogActionsContext';

// WebMCP: expose the blog actions as tools to an AI agent built into the browser. The agent
// calls them inside this page, so they run as the signed-in user, through the same runner
// (validation, sign-in check, publish confirmation) as the command bar.
//
// Experimental: Chrome ships it behind chrome://flags/#enable-webmcp-testing or an origin trial.
// In any other browser `modelContext` is missing and this component does nothing.

type ModelContextLike = {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      execute: (input: unknown) => Promise<unknown>;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
    },
    options?: { signal?: AbortSignal },
  ): unknown;
};

export function getModelContext(): ModelContextLike | undefined {
  if (typeof document === 'undefined') return undefined;
  // `document.modelContext` is the current spec; `navigator.modelContext` is the older,
  // deprecated location some browsers still ship.
  const doc = document as Document & { modelContext?: ModelContextLike };
  const nav = navigator as Navigator & { modelContext?: ModelContextLike };
  return doc.modelContext ?? nav.modelContext;
}

export function WebMcpTools() {
  const runner = useBlogActions();

  useEffect(() => {
    const modelContext = getModelContext();
    if (!modelContext) return undefined;

    // Aborting the signal unregisters every tool (on unmount, or React's dev double-mount).
    const controller = new AbortController();
    for (const action of BLOG_ACTIONS) {
      Promise.resolve(
        modelContext.registerTool(
          {
            name: action.name,
            description: action.description,
            inputSchema: action.inputSchema,
            execute: (input) => runner.run(action.name, input),
            annotations: {
              readOnlyHint: action.readOnly,
              // Search results contain text written by other users: agents should not obey it.
              untrustedContentHint: action.name === 'find_posts',
            },
          },
          { signal: controller.signal },
        ),
      ).catch((err: unknown) => console.warn(`[webmcp] could not register ${action.name}`, err));
    }
    return () => controller.abort();
  }, [runner]);

  return null;
}
