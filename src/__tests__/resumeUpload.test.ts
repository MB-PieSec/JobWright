import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_RESUME_BYTES,
  saveResumeUpload,
  validateResumeUpload,
} from "../resume/upload.js";
import type { ResumeProfile } from "../resume/schema.js";

const PROFILE: ResumeProfile = {
  name: "Test User",
  totalYearsExperience: 3,
  seniorityLevel: "mid",
  skills: ["TypeScript"],
  workHistory: [
    {
      title: "Engineer",
      company: "Example",
      durationMonths: 36,
      summary: "Built things.",
    },
  ],
};

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jobwright-resume-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("validateResumeUpload", () => {
  it("accepts a Markdown file and strips any path components", () => {
    const result = validateResumeUpload({
      filename: "../private/resume.md",
      content: "# Resume\n\nHello",
    });

    expect(result).toEqual({
      ok: true,
      value: { filename: "resume.md", content: "# Resume\n\nHello" },
    });
  });

  it("accepts the .MD extension case-insensitively", () => {
    expect(
      validateResumeUpload({ filename: "RESUME.MD", content: "hello" }).ok,
    ).toBe(true);
  });

  it("rejects non-Markdown formats", () => {
    const result = validateResumeUpload({
      filename: "resume.pdf",
      content: "hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Markdown \(\.md\)/);
  });

  it("rejects empty and oversized files", () => {
    expect(
      validateResumeUpload({ filename: "resume.md", content: "" }).ok,
    ).toBe(false);

    const oversized = "a".repeat(MAX_RESUME_BYTES + 1);
    const result = validateResumeUpload({
      filename: "resume.md",
      content: oversized,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/smaller than/);
  });

  it("rejects malformed request bodies", () => {
    expect(validateResumeUpload({ content: "hello" }).ok).toBe(false);
    expect(validateResumeUpload(null).ok).toBe(false);
  });
});

describe("saveResumeUpload", () => {
  it("writes the original Markdown and the parsed profile", async () => {
    const dir = await makeTempDir();
    const profilePath = path.join(dir, "profile.json");
    const resumePath = path.join(dir, "resume.md");

    const result = await saveResumeUpload(
      { filename: "my-resume.md", content: "# Test" },
      { profilePath, resumePath },
      async () => PROFILE,
    );

    expect(result.profile).toEqual(PROFILE);
    expect(result.source.filename).toBe("my-resume.md");
    expect(result.source.size).toBe(6);

    expect(await readFile(resumePath, "utf8")).toBe("# Test");
    expect(JSON.parse(await readFile(profilePath, "utf8"))).toEqual(PROFILE);
  });

  it("does not touch files when parsing fails", async () => {
    const dir = await makeTempDir();
    const profilePath = path.join(dir, "profile.json");
    const resumePath = path.join(dir, "resume.md");

    await expect(
      saveResumeUpload(
        { filename: "resume.md", content: "# Test" },
        { profilePath, resumePath },
        async () => {
          throw new Error("LLM failed");
        },
      ),
    ).rejects.toThrow("LLM failed");

    await expect(access(resumePath)).rejects.toThrow();
    await expect(access(profilePath)).rejects.toThrow();
  });
});
