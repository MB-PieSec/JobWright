import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function getUserInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(prompt);
  rl.close();
  return answer;
}
