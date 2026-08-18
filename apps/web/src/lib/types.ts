export type PublicUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Comment = {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  createdAt: string;
  author: { id: string; name: string };
};

/** Shape returned by the list endpoint (`GET /api/posts`) — no `content`. */
export type PostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  category: Category | null;
  _count: { comments: number; likes: number };
};

/** Shape returned by single-post endpoints — includes the full body. */
export type Post = PostSummary & {
  content: string;
};
