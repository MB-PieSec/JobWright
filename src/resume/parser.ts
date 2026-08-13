import { ResumeProfile } from "./schema.js";
import { ResumeProfileSchema } from "./schema.js";
import 'dotenv/config';
import { openRouterWrapper } from "../llm/client.js";
import { stripCodeFences } from "../utils/stripCodeFences.js";

function scoreResumePrompt(contents:string): string {
  return `
    You are extracting structured data from a resume.
    Return ONLY valid JSON, no markdown fences, no explanation.
    Shape required: name (string), skills (string[]),
    workHistory (array of {title, company, durationMonths, summary})
  
    Rules for workHistory:
    - Group all projects, achievements, and bullet points under the SAME employer/client into a SINGLE workHistory entry.
    - Do NOT create a separate entry for each project, achievement, or bullet point.
    - One entry per distinct employer or client only.
    - Combine multiple achievements for the same employer into one "summary" field, using semicolons or short sentences to separate them.
    - Only include entries under work experience/employment sections. Do NOT include skills, education, or certifications as work history.
  
    Resume:
    ${contents}
  `;
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
  const prompt = scoreResumePrompt(contents)
  const modelText = await openRouterWrapper(prompt);
  const cleanedJson = stripCodeFences(modelText);
  const parsedJson = JSON.parse(cleanedJson);
  const computed = computeExperienceLevel(parsedJson.workHistory);
  const merged = { ...parsedJson, ...computed };
  const validatedProfile = ResumeProfileSchema.parse(merged);
  return validatedProfile;
}
