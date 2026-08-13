import { JobScoreSchema } from "./schema.js";
import { JobScore } from "./schema.js";
import { ResumeProfile } from "../resume/schema.js";
import { openRouterWrapper } from "../llm/client.js";
import { stripCodeFences } from "../utils/stripCodeFences.js";

function scoreResumePrompt(resumeProfile:ResumeProfile, jobDescription: string, reasoningMaxLength: number): string {
  return `
    You are scoring how well a candidate's resume matches a job posting.
    
    Resume profile (JSON):
    ${JSON.stringify(resumeProfile)}
    
    Job posting:
    ${jobDescription}
    
    Step 1: Identify every requirement stated in the posting. If the posting 
    separates "required" from "nice to have," respect that split. If it does 
    not separate them, treat every listed qualification as required.
    
    Step 2: For each requirement, determine whether the resume clearly satisfies 
    it, based only on what's explicitly present in the resume profile — do not 
    assume related experience counts unless it's a close, obvious match (e.g. 
    "Express.js" experience reasonably implies familiarity with "Node.js").
    
    Step 3: Count how many required items are met versus unmet.
    
    Score using this formula as your baseline, then adjust only slightly for 
    severity (e.g. missing the core language/framework is worse than missing a 
    minor tool):
      score ≈ 100 × (requirements met / total requirements)
    
    Example:
      Posting requires: Go, PostgreSQL, Docker, gRPC (4 required)
      Resume has: PostgreSQL, Docker (2 of 4 met)
      Baseline score: 100 × (2/4) = 50
      Adjustment: Go is the core language and is missing entirely → lower to 35
      Output: { "score": 35, "missingRequirements": ["Go", "gRPC"], 
                "reasoning": "Missing the core language (Go) and gRPC; has 
                PostgreSQL and Docker experience." }
    
    Do not default to round or "safe-sounding" numbers like 70, 75, or 80 out of 
    uncertainty — commit to a specific value that reflects the actual count of 
    met versus unmet requirements.
    
    Respond with ONLY valid JSON, no markdown code fences, no explanation outside 
    the JSON, in exactly this shape:
    {
      "score": <number 0-100>,
      "requirementsMet": <number>,
      "requirementsTotal": <number>,
      "missingRequirements": [<string>, ...],
      "reasoning": "<1-2 sentence explanation of the score, under ${reasoningMaxLength} characters>"
    }
  `;
}
export async function scoreResume(resumeProfile: ResumeProfile, jobDescription:string, reasoningMaxLength:number): Promise<JobScore>{
  const prompt = scoreResumePrompt(resumeProfile, jobDescription, reasoningMaxLength);
  const rawResponse = await openRouterWrapper(prompt);
  const cleaned = stripCodeFences(rawResponse);
  const parsed = JSON.parse(cleaned);
  return JobScoreSchema.parse(parsed);
  
}