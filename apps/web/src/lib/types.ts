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

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
