import { ResumeProfile } from "./schema.js";
import { ResumeProfileSchema } from "./schema.js";
import 'dotenv/config';
import { openRouterWrapper } from "../llm/client.js";
import { stripCodeFences } from "../utils/stripCodeFences.js";

function scoreResumePrompt(contents: string): string {
  return `
    You are extracting structured data from a resume.
    Return ONLY valid JSON, no markdown fences, no explanation.
    Shape required: name (string), skills (string[]),
    workHistory (array of {title, company, durationMonths, summary}),
    projects (array of {title, summary}, optional),
    city (string, optional), province (string, optional)

    Rules for workHistory:
    - Group all projects, achievements, and bullet points under the SAME employer/client into a SINGLE workHistory entry.
    - Do NOT create a separate entry for each project, achievement, or bullet point.
    - One entry per distinct employer or client only.
    - Combine multiple achievements for the same employer into one "summary" field, using semicolons or short sentences to separate them.
    - Only include entries under work experience/employment sections. Do NOT include skills, education, or certifications as work history.

    Rules for projects:
    - Extract entries from a PROJECTS section (personal, freelance, or portfolio projects not tied to formal employment).
    - One entry per distinct project. Combine bullet points for the same project into one "summary" field.
    - Do NOT include these entries in workHistory, even if they resemble work experience.
    - If there is no PROJECTS section, omit this field entirely rather than inventing entries.

    Rules for city/province:
    - Extract from the candidate's stated address or location on the resume, if present.
    - If the resume does not state a location, omit both fields rather than guessing.
    - Return city and province in Persian script (e.g. "رشت" not "Rasht", "گیلان" not "Gilan"), using the standard spelling as it would appear on an Iranian job site — even if the resume itself states the location in English or Latin script.

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
