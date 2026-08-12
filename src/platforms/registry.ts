import type { JobPlatform } from "./types.js";
import { jobinjaAdapter } from "./jobinja/adapter.js";

export const platformRegistry = {
  jobinja: jobinjaAdapter,
} satisfies Record<string, JobPlatform>;

export type PlatformName = keyof typeof platformRegistry;
