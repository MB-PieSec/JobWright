import type { JobPlatform } from "./types.js";
import { jobinjaAdapter } from "./jobinja/adapter.js";
import { jobvisionAdapter } from "./jobvision/adapter.js";

export const platformRegistry = {
  jobinja: jobinjaAdapter,
  jobvision: jobvisionAdapter,
} satisfies Record<string, JobPlatform>;

export type PlatformName = keyof typeof platformRegistry;
