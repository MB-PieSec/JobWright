import { ResumeProfile } from "./schema.js";
import { ResumeProfileSchema } from "./schema.js";
import 'dotenv/config';
import { openRouterWrapper } from "../llm/client.js";

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const withoutOpening = trimmed.slice(trimmed.indexOf("\n") + 1);
    const withoutClosing = withoutOpening.slice(0, withoutOpening.lastIndexOf("```"));
    return withoutClosing.trim();
  }
  return trimmed;
}

export function computeExperienceLevel(workHistory: { durationMonths: number }[]) {
  const totalMonths = workHistory.reduce((sum, role) => sum + role.durationMonths, 0);
  const totalYearsExperience = Math.round((totalMonths / 12) * 10) / 10; // one decimal

  let seniorityLevel: "junior" | "mid" | "senior" | "lead";
  if (totalYearsExperience < 2) seniorityLevel = "junior";
  else if (totalYearsExperience < 5) seniorityLevel = "mid";
  else if (totalYearsExperience < 9) seniorityLevel = "senior";
  else seniorityLevel = "lead";

  return { totalYearsExperience, seniorityLevel };
}

export async function parseResume(contents: string): Promise<ResumeProfile> {
  const modelText = await openRouterWrapper(contents);
  const cleanedJson = stripCodeFences(modelText);
  const parsedJson = JSON.parse(cleanedJson);
  const computed = computeExperienceLevel(parsedJson.workHistory);
  const merged = { ...parsedJson, ...computed };
  const validatedProfile = ResumeProfileSchema.parse(merged);
  return validatedProfile;
}
