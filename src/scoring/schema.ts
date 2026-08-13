
import { z } from "zod";

export const JobScoreSchema = z.object({
  score: z.number().min(0).max(100),
  requirementsMet: z.number().int().min(0),
  requirementsTotal: z.number().int().min(0),
  missingRequirements: z.array(z.string()),
  reasoning: z.string(),
});

export type JobScore = z.infer<typeof JobScoreSchema>;