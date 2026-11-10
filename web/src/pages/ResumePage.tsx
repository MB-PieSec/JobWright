import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { fetchResume, uploadResume } from "../api";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import type { ToastKind } from "../components/Toast";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  FileTextIcon,
  InfoIcon,
  LoaderIcon,
  RefreshIcon,
  UploadIcon,
} from "../components/icons";
import { cn } from "../lib/cn";
import { formatDateTime, formatNumber } from "../lib/format";
import { useI18n, type Translate } from "../i18n";
import type { ResumeProfile, ResumeResponse, ResumeSource } from "../types";

type Notify = (kind: ToastKind, message: string) => void;

const MAX_BYTES = 256 * 1024;
const ACCEPT = ".md,text/markdown";

interface ResumePageProps {
  notify: Notify;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function validateFile(file: File, t: Translate): string | null {
  if (!file.name.toLowerCase().endsWith(".md")) {
    return t("Only Markdown (.md) files are supported for now.");
  }
  if (file.size === 0) return t("The selected file is empty.");
  if (file.size > MAX_BYTES) {
    return t("The resume must be smaller than {size} KB.", {
      size: Math.round(MAX_BYTES / 1024),
    });
  }
  return null;
}

export function ResumePage({ notify }: ResumePageProps) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<ResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchResume(controller.signal)
      .then((response) => {
        setData(response);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : String(caught));
        setLoading(false);
      });

    return () => controller.abort();
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const chooseFile = useCallback(
    (next: File | null) => {
      setUploadError(null);

      if (!next) {
        setFile(null);
        return;
      }

      const problem = validateFile(next, t);
      if (problem) {
        setUploadError(problem);
        setFile(null);
        return;
      }

      setFile(next);
    },
    [t],
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const content = await file.text();
      const result = await uploadResume({ filename: file.name, content });
      notify(
        "success",
        t("Resume parsed and saved for {name}.", {
          name: result.profile.name,
        }),
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      reload();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setUploadError(message);
      notify("error", message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-xl border border-line bg-linear-to-br from-accent-2-soft/70 via-surface to-accent-soft/60 p-5 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-20 h-44 w-44 rounded-full bg-accent-2/10 blur-2xl"
        />
        <div className="relative">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {t("Resume")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t(
              "Upload a Markdown resume. JobWright parses it into the profile used for filtering, scoring, and applying.",
            )}
          </p>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        <section className="rounded-lg border border-line bg-surface shadow-sm lg:col-span-2">
          <header className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">
              {t("Upload resume")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {t(
                "Replaces the active profile and keeps the original Markdown.",
              )}
            </p>
          </header>

          <div className="space-y-3 p-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "rounded-lg border border-dashed p-6 text-center motion-safe:transition-colors motion-safe:duration-150",
                dragging
                  ? "border-accent bg-accent-soft"
                  : "border-line-strong bg-surface-sunken/40",
              )}
            >
              <UploadIcon className="mx-auto h-6 w-6 text-ink-subtle" />
              <p className="mt-2 text-sm font-medium text-ink">
                {t("Drop a Markdown resume here")}
              </p>
              <p className="mt-1 text-xs text-ink-subtle">
                {t("or choose a file from your computer")}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <FileTextIcon className="h-3.5 w-3.5" />
                {t("Choose .md file")}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                aria-label={t("Choose a Markdown resume")}
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
                disabled={uploading}
              />
            </div>

            {file && (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-3">
                <FileTextIcon className="h-4 w-4 shrink-0 text-accent-text" />
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-sm text-ink">
                    {file.name}
                  </p>
                  <p className="text-2xs text-ink-subtle">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => chooseFile(null)}
                  disabled={uploading}
                >
                  {t("Remove")}
                </Button>
              </div>
            )}

            {uploadError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-text"
              >
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span dir="auto">{uploadError}</span>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={() => void handleUpload()}
              disabled={!file || uploading}
            >
              {uploading ? (
                <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <UploadIcon className="h-4 w-4" />
              )}
              {uploading ? t("Parsing with the LLM…") : t("Upload & parse")}
            </Button>

            <p className="flex items-start gap-1.5 text-2xs text-ink-subtle">
              <InfoIcon className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {t(
                  "Only .md files are supported for now. Other formats are coming later. The original file is kept as resume.md and the parsed profile as profile.json.",
                )}
              </span>
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-surface shadow-sm lg:col-span-3">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {t("Active profile")}
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {data?.source
                  ? t("Uploaded {date}", {
                      date: formatDateTime(data.source.uploadedAt, locale),
                    })
                  : data?.profileUpdatedAt
                    ? t("Updated {date}", {
                        date: formatDateTime(data.profileUpdatedAt, locale),
                      })
                    : t("No profile yet")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={reload}
              disabled={loading}
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              {t("Refresh")}
            </Button>
          </header>

          <div className="p-4">
            {loading && !data ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2 text-sm text-danger-text">
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span dir="auto">{error}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={reload}>
                  {t("Retry")}
                </Button>
              </div>
            ) : data?.profile ? (
              <ProfileSummary
                profile={data.profile}
                source={data.source}
                updatedAt={data.profileUpdatedAt}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-line px-4 py-12 text-center">
                <FileTextIcon className="mx-auto h-6 w-6 text-ink-subtle" />
                <p className="mt-2 text-sm font-medium text-ink">
                  {t("No resume uploaded yet")}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {t("Upload a .md file to create profile.json.")}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileSummary({
  profile,
  source,
  updatedAt,
}: {
  profile: ResumeProfile;
  source: ResumeSource | null;
  updatedAt: string | null;
}) {
  const { t, locale } = useI18n();
  const location = [profile.city, profile.province]
    .filter((value): value is string => Boolean(value))
    .join(", ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p dir="auto" className="text-base font-semibold text-ink">
            {profile.name}
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {t("{years} years experience · {level}", {
              years: formatNumber(profile.totalYearsExperience, locale),
              level: t(profile.seniorityLevel),
            })}
            {location && (
              <>
                {" "}
                · <span dir="auto">{location}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {source && (
            <span
              title={source.filename}
              className="inline-flex max-w-56 items-center gap-1.5 rounded-full bg-surface-sunken px-2 py-0.5 text-2xs text-ink-muted ring-1 ring-line ring-inset"
            >
              <FileTextIcon className="h-3 w-3 shrink-0" />
              <span dir="auto" className="truncate">
                {source.filename}
              </span>
            </span>
          )}
          {!source && updatedAt && (
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-2xs text-ink-muted ring-1 ring-line ring-inset">
              {t("Source not recorded")}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label={t("Skills")} value={profile.skills.length} />
        <MiniStat label={t("Roles")} value={profile.workHistory.length} />
        <MiniStat label={t("Projects")} value={profile.projects?.length ?? 0} />
      </div>

      <section>
        <h3 className="text-xs font-medium text-ink-muted">{t("Skills")}</h3>
        {profile.skills.length === 0 ? (
          <p className="mt-1 text-xs text-ink-subtle">
            {t("No skills recorded.")}
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <li
                key={skill}
                dir="auto"
                className="rounded-md bg-surface-sunken px-2 py-1 text-2xs text-ink-muted ring-1 ring-line ring-inset"
              >
                {skill}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-medium text-ink-muted">
          {t("Experience")}
        </h3>
        {profile.workHistory.length === 0 ? (
          <p className="mt-1 text-xs text-ink-subtle">
            {t("No work history recorded.")}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {profile.workHistory.map((role, index) => (
              <li
                key={`${role.company}-${role.title}-${index}`}
                className="rounded-lg border border-line p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p dir="auto" className="text-sm font-medium text-ink">
                      {role.title}
                    </p>
                    <p dir="auto" className="mt-0.5 text-xs text-ink-muted">
                      {role.company}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-2xs text-ink-subtle">
                    {t("{years} yrs", {
                      years: formatNumber(
                        Math.round((role.durationMonths / 12) * 10) / 10,
                        locale,
                      ),
                    })}
                  </span>
                </div>
                {role.summary && (
                  <p
                    dir="auto"
                    className="mt-2 text-xs leading-5 text-ink-subtle"
                  >
                    {role.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile.projects && profile.projects.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-ink-muted">
            {t("Projects")}
          </h3>
          <ul className="mt-2 space-y-2">
            {profile.projects.map((project, index) => (
              <li
                key={`${project.title}-${index}`}
                className="rounded-lg border border-line p-3"
              >
                <p dir="auto" className="text-sm font-medium text-ink">
                  {project.title}
                </p>
                {project.summary && (
                  <p
                    dir="auto"
                    className="mt-1 text-xs leading-5 text-ink-subtle"
                  >
                    {project.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.education && profile.education.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-ink-muted">
            {t("Education")}
          </h3>
          <ul className="mt-2 space-y-2">
            {profile.education.map((entry, index) => (
              <li
                key={`${entry.institution}-${entry.degree}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
              >
                <div className="min-w-0">
                  <p dir="auto" className="text-sm font-medium text-ink">
                    {entry.degree}
                  </p>
                  <p dir="auto" className="mt-0.5 text-xs text-ink-muted">
                    {entry.institution}
                    {entry.field ? ` · ${entry.field}` : ""}
                  </p>
                </div>
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-status-applied" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  const { locale } = useI18n();
  return (
    <div className="rounded-lg border border-line bg-surface-sunken/40 p-3">
      <p className="text-2xs font-medium text-ink-subtle">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-ink tabular-nums">
        {formatNumber(value, locale)}
      </p>
    </div>
  );
}
