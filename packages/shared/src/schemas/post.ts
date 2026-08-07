import { z } from 'zod';

export const CreatePostInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().max(300).optional(),
});
export type CreatePostInput = z.infer<typeof CreatePostInputSchema>;

export const UpdatePostInputSchema = CreatePostInputSchema.partial();
export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;
