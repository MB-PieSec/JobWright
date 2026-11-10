import { useI18n } from "../i18n";
import type { Theme } from "../hooks/useTheme";
import { Button } from "./Button";
import { LanguagesIcon, MenuIcon, MoonIcon, SunIcon } from "./icons";

interface TopBarProps {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenNav: () => void;
  pageTitle: string;
}

export function TopBar({
  theme,
  onToggleTheme,
  onOpenNav,
  pageTitle,
}: TopBarProps) {
  const { language, toggleLanguage, t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div
        aria-hidden="true"
        className="h-0.5 w-full bg-linear-to-r from-accent via-accent-2 to-accent-3"
      />
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenNav}
            aria-label={t("Open navigation")}
            aria-haspopup="dialog"
          >
            <MenuIcon />
          </Button>

          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-accent via-accent-2 to-accent-3 font-mono text-xs font-semibold text-white shadow-sm"
            aria-hidden="true"
          >
            JW
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-ink sm:inline">
            JobWright
          </span>
          <span className="text-ink-subtle" aria-hidden="true">
            /
          </span>
          <span className="truncate text-sm font-medium text-ink-muted">
            {pageTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            aria-label={
              language === "fa"
                ? t("Switch to English")
                : t("Switch to Persian")
            }
            title={language === "fa" ? "English" : "فارسی"}
            className="gap-1.5"
          >
            <LanguagesIcon className="h-4 w-4" />
            <span className="font-mono text-2xs font-semibold uppercase">
              {language === "fa" ? "FA" : "EN"}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label={
              theme === "dark"
                ? t("Switch to light mode")
                : t("Switch to dark mode")
            }
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </div>
    </header>
  );
}
