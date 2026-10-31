import { z } from 'zod';

export const DEFAULT_TRUST = { trustpilot_score: 4.4, trustpilot_reviews: 10 };
export const trustSettingsSchema = z.object({
  trustpilot_score: z.number().min(0).max(5).multipleOf(0.1),
  trustpilot_reviews: z.number().int().min(0).max(2147483647),
});