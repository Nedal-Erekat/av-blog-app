export type PublicUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
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
};
