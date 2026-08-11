import { ResumeProfile } from "./schema.js";
import { ResumeProfileSchema } from "./schema.js";
import 'dotenv/config';

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
  const prompt = `
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
  const rawResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${process.env.openRouterAPIKEY}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'meta-llama/llama-3.1-8b-instruct',
                "temperature": 0.2,
                messages: [{ role: 'user', content: prompt }]
              })
          });
  if (!rawResponse.ok) {
    throw new Error(`HTTP error! status: ${rawResponse.status}`);
  };
  const data = await rawResponse.json();
  const modelText = data.choices[0].message.content;
  const cleanedJson = stripCodeFences(modelText);
  const parsedJson = JSON.parse(cleanedJson);
  const computed = computeExperienceLevel(parsedJson.workHistory);
  const merged = { ...parsedJson, ...computed };
  const validatedProfile = ResumeProfileSchema.parse(merged);
  return validatedProfile;
}
