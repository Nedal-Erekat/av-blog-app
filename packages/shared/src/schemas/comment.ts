import { z } from 'zod';

export const CreateCommentInputSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(1000),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;
