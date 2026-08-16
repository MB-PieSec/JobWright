import { z } from "zod";

export const ResumeProfileSchema = z.object({
  name: z.string(),

  totalYearsExperience: z.number(),
  seniorityLevel: z.enum(["junior", "mid", "senior", "lead"]),


  skills: z.array(z.string()),

  workHistory: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      durationMonths: z.number(),
      summary: z.string(),

    })
  ),

  projects: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
      })
    )
    .optional(),

  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      field: z.string().optional(),
    })
  ).optional(),

  city: z.string().optional(),
  province: z.string().optional(),
});

export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;
