import { z } from 'zod';
import { idSchema } from '../primitives';
import { documentCategoryEnum, documentReviewStatusEnum } from '../enums';

/**
 * Review-tray row for a document the auto-filer could not confidently place
 * (D-13 thin-slice). `confidence` is the matcher's 0..1 score.
 */
export const documentReviewSchema = z.object({
  id: idSchema,
  fileId: idSchema,
  suggestedClientId: idSchema.optional(),
  suggestedProjectId: idSchema.optional(),
  suggestedCategory: documentCategoryEnum.optional(),
  confidence: z.number().min(0).max(1),
  status: documentReviewStatusEnum.default('pending'),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DocumentReview = z.infer<typeof documentReviewSchema>;
