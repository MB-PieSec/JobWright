import { stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { loadProfile, ProfileNotFoundError } from "../../resume/loadProfile.js";
import {
  RESUME_EXTENSION,
  saveResumeUpload,
  validateResumeUpload,
  type ResumeSource,
} from "../../resume/upload.js";
import { getSetting, setSetting } from "../../settings/store.js";

const PROFILE_PATH = process.env.JOBWRIGHT_PROFILE_PATH ?? "./profile.json";
const RESUME_PATH = process.env.JOBWRIGHT_RESUME_PATH ?? "./resume.md";

async function currentResume() {
  let profile = null;

  try {
    profile = await loadProfile(PROFILE_PATH, { interactive: false });
  } catch (err) {
    if (!(err instanceof ProfileNotFoundError)) throw err;
  }

  let profileUpdatedAt: string | null = null;
  try {
    profileUpdatedAt = (await stat(PROFILE_PATH)).mtime.toISOString();
  } catch {
    // No profile has been written yet.
  }

  return {
    profile,
    source: getSetting<ResumeSource>("resume.source"),
    profileUpdatedAt,
    supportedExtensions: [RESUME_EXTENSION],
  };
}

const resumeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/resume", async () => currentResume());

  app.post("/resume", async (req, reply) => {
    const validation = validateResumeUpload(req.body);
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }

    try {
      const result = await saveResumeUpload(validation.value, {
        profilePath: PROFILE_PATH,
        resumePath: RESUME_PATH,
      });

      setSetting("resume.source", result.source);
      return reply.code(201).send(result);
    } catch (err) {
      req.log.error({ err }, "Resume upload failed");
      const message = err instanceof Error ? err.message : String(err);
      return reply
        .code(422)
        .send({ error: `Could not parse the resume: ${message}` });
    }
  });
};

export default resumeRoutes;
