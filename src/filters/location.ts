import { normalizePersian } from "../utils/normalizePersian.js";

export function meetsLocationRequirement(
  jobLocationRaw: string | undefined,
  cooperationTypeRaw: string | undefined,
  candidateCity: string | undefined,
  candidateProvince: string | undefined,
  hardMatch: boolean
): boolean {
  // remote always passes, regardless of everything else
  if (cooperationTypeRaw?.includes("دورکاری")) {
    return true;
  }

  // can't filter without knowing where the candidate wants to work
  if (!candidateCity || !candidateProvince) {
    return true;
  }

  // can't filter without knowing where the job is
  if (!jobLocationRaw) {
    return true;
  }

  const parts = jobLocationRaw.split("،").map((s) => s.trim());
  const [jobProvince, jobCity] = parts;

  if (hardMatch) {
    return normalizePersian(jobCity) === normalizePersian(candidateCity);
  }

  return normalizePersian(jobProvince) === normalizePersian(candidateProvince);
}
