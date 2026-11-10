import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { parseResume } from "./parser.js";
import type { ResumeProfile } from "./schema.js";

export const RESUME_EXTENSION = ".md";
export const MAX_RESUME_BYTES = 256 * 1024;

export interface ResumeSource {
  filename: string;
  uploadedAt: string;
  size: number;
}

export interface ResumeUploadInput {
  filename: string;
  content: string;
}

export interface ResumeUploadResult {
  profile: ResumeProfile;
  source: ResumeSource;
}

const ResumeUploadSchema = z
  .object({
    filename: z.string().min(1).max(255),
    content: z.string().min(1),
  })
  .strict();

export type ResumeUploadValidation =
  { ok: true; value: ResumeUploadInput } | { ok: false; error: string };

/**
 * Validates an upload before any LLM work happens. Only Markdown is accepted
 * for now; the filename is stripped to a basename because it is display
 * metadata, never a path the server writes to.
 */
export function validateResumeUpload(input: unknown): ResumeUploadValidation {
  const parsed = ResumeUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "A resume filename and Markdown content are required.",
    };
  }

  const filename = path.basename(parsed.data.filename.trim());
  if (!filename || path.extname(filename).toLowerCase() !== RESUME_EXTENSION) {
    return {
      ok: false,
      error: "Only Markdown (.md) resumes are supported for now.",
    };
  }

  const size = Buffer.byteLength(parsed.data.content, "utf8");
  if (size === 0) {
    return { ok: false, error: "The resume file is empty." };
  }
  if (size > MAX_RESUME_BYTES) {
    return {
      ok: false,
      error: `The resume must be smaller than ${Math.round(
        MAX_RESUME_BYTES / 1024,
      )} KB.`,
    };
  }

  return { ok: true, value: { filename, content: parsed.data.content } };
}

/**
 * Parses the resume into the profile schema, then writes both the original
 * Markdown and the generated profile.json. Parsing happens first so a failed
 * LLM call never leaves a half-written profile behind.
 */
export async function saveResumeUpload(
  input: ResumeUploadInput,
  paths: { profilePath: string; resumePath: string },
  parse: (content: string) => Promise<ResumeProfile> = parseResume,
): Promise<ResumeUploadResult> {
  const profile = await parse(input.content);
  const uploadedAt = new Date().toISOString();
  const source: ResumeSource = {
    filename: path.basename(input.filename),
    uploadedAt,
    size: Buffer.byteLength(input.content, "utf8"),
  };

  await mkdir(path.dirname(paths.resumePath), { recursive: true });
  await writeFile(paths.resumePath, input.content, "utf8");

  await mkdir(path.dirname(paths.profilePath), { recursive: true });
  const tempProfilePath = `${paths.profilePath}.tmp`;
  await writeFile(tempProfilePath, JSON.stringify(profile, null, 2), "utf8");
  await rename(tempProfilePath, paths.profilePath);

  return { profile, source };
}
