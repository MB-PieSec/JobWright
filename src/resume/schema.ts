import { z } from "zod";

export const ResumeProfileSchema = z.object({
  name: z.string(),

  // Cheap hard-filter field — compute this from work history during parsing,
  // don't trust the LLM to just "know" seniority without reasoning about it
  totalYearsExperience: z.number(),
  seniorityLevel: z.enum(["junior", "mid", "senior", "lead"]),

  // Flat list — good enough for V0 matching, avoid overengineering into
  // skill+proficiency+years right now
  skills: z.array(z.string()),

  workHistory: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      durationMonths: z.number(),
      summary: z.string(), // one or two sentences, NOT the full bullet list —
                            // keeps prompt size sane when this gets sent to the scorer later
    })
  ),

  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      field: z.string().optional(),
    })
  ).optional(), // genuinely optional — not everyone lists it, and scorer rarely needs it

  // Optional but useful later for filtering ("remote only") or personalizing
  // cover letters — skip populating this in V0 if it adds parsing friction
  location: z.string().optional(),
});

export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;