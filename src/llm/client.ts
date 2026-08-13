import 'dotenv/config';

export async function openRouterWrapper(prompt: string): Promise<string>{

  const rawResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${process.env.openRouterAPIKEY}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'openai/gpt-4o-mini',
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
