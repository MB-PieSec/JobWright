import { readFile } from 'node:fs/promises';
export async function readFileContent(filePath: string): Promise<string> {
  try {
    const contents = await readFile(filePath, { encoding: 'utf8' });
    return contents;
  } catch (err: any) {
    console.error(err.message);
    throw err;
  }
}