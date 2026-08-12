import 'dotenv/config';

export async function openRouterWrapper(contents: string): Promise<string>{
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
    const errorBody = await rawResponse.text();
    throw new Error(`HTTP error! status: ${rawResponse.status} - ${errorBody}`);
  };
  const data = await rawResponse.json();
  return data.choices[0].message.content;
}
