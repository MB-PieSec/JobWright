/**
 * Cookie domains JobWright actually needs. Everything else in the browser
 * store is ignored — and never decrypted — to keep the import minimal.
 */
export const JOB_COOKIE_DOMAINS = ["jobinja.ir", "jobvision.ir"] as const;

export function isJobDomain(host: string): boolean {
  const normalized = host.replace(/^\./, "").toLowerCase();
  return JOB_COOKIE_DOMAINS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}
