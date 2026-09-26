import { CreatePostInputSchema, type CreatePostInput } from '@av-blog/shared';

// Hands a draft to the New Post page. A full post is too long for a URL, so it goes through
// sessionStorage (this tab only, cleared when read). An event covers the case where the
// editor is already open and won't re-mount.
const KEY = 'av-blog:pending-draft';
export const DRAFT_READY_EVENT = 'av-blog:draft-ready';

export function savePendingDraft(draft: CreatePostInput) {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
  window.dispatchEvent(new Event(DRAFT_READY_EVENT));
}

// Returns the draft once, then forgets it. Anything malformed is ignored, not trusted.
export function takePendingDraft(): CreatePostInput | null {
  const raw = sessionStorage.getItem(KEY);
  if (raw === null) return null;
  sessionStorage.removeItem(KEY);
  try {
    const parsed = CreatePostInputSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
