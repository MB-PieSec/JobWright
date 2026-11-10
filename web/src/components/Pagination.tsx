import { useI18n } from "../i18n";
import { formatNumber } from "../lib/format";
import { Button } from "./Button";
import { Select } from "./Select";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const PAGE_SIZES = [20, 50, 100];

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
  disabled?: boolean;
}

export function Pagination({
  total,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
  disabled = false,
}: PaginationProps) {
  const { t, locale } = useI18n();
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canGoBack = offset > 0 && !disabled;
  const canGoForward = offset + limit < total && !disabled;

  return (
    <nav
      aria-label={t("Pagination")}
      className="border-t border-line bg-surface"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-xs text-ink-muted" aria-live="polite">
          {total === 0
            ? t("No jobs")
            : t("Showing {from}–{to} of {total}", {
                from: formatNumber(from, locale),
                to: formatNumber(to, locale),
                total: formatNumber(total, locale),
              })}
        </p>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="hidden sm:inline">{t("Rows")}</span>
            <Select
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              aria-label={t("Rows per page")}
              className="w-20"
              disabled={disabled}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {formatNumber(size, locale)}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              aria-label={t("Previous page")}
              disabled={!canGoBack}
              onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            >
              <ChevronLeftIcon className="rtl:rotate-180" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label={t("Next page")}
              disabled={!canGoForward}
              onClick={() => onOffsetChange(offset + limit)}
            >
              <ChevronRightIcon className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
