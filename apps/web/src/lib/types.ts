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

export type Post = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  category: Category | null;
  _count: { comments: number; likes: number };
};

export type SearchResult = {
  post: Post;
  // Cosine similarity 0..1 for semantic results; null for keyword matches.
  similarity: number | null;
};

// What the consent page shows about an AI app asking for access.
export type OAuthGrantInfo = {
  clientName: string;
  clientUri: string | null;
  redirectHost: string;
  scopes: string[];
};
