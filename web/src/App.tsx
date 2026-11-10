import { useCallback, useRef, useState } from "react";
import { NavDrawer } from "./components/NavDrawer";
import { useI18n } from "./i18n";
import {
  ToastViewport,
  type ToastItem,
  type ToastKind,
} from "./components/Toast";
import { TopBar } from "./components/TopBar";
import { useHashRoute, type Route } from "./hooks/useHashRoute";
import { useTheme } from "./hooks/useTheme";
import { AiPage } from "./pages/AiPage";
import { JobsPage } from "./pages/JobsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ResumePage } from "./pages/ResumePage";
import { RunsPage } from "./pages/RunsPage";
import { SettingsPage } from "./pages/SettingsPage";

const PAGE_TITLES: Record<Route, string> = {
  overview: "Overview",
  jobs: "Jobs",
  runs: "Runs",
  resume: "Resume",
  ai: "AI providers",
  notifications: "Notifications",
  settings: "Settings",
};

export function App() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const [route, navigate] = useHashRoute();
  const [navOpen, setNavOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastId = useRef(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = ++nextToastId.current;
    setToasts((current) => [...current, { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <div className="relative min-h-dvh bg-canvas text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -end-24 -top-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -start-32 top-1/3 h-72 w-72 rounded-full bg-accent-2/10 blur-3xl" />
        <div className="absolute end-1/4 -bottom-24 h-64 w-64 rounded-full bg-accent-3/10 blur-3xl" />
      </div>

      <div className="relative">
        <TopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenNav={() => setNavOpen(true)}
          pageTitle={t(PAGE_TITLES[route])}
        />

        <NavDrawer
          open={navOpen}
          route={route}
          onNavigate={navigate}
          onClose={() => setNavOpen(false)}
        />

        {route === "overview" && (
          <OverviewPage onOpenRuns={() => navigate("runs")} />
        )}
        {route === "jobs" && <JobsPage notify={notify} />}
        {route === "runs" && <RunsPage notify={notify} />}
        {route === "resume" && <ResumePage notify={notify} />}
        {route === "ai" && <AiPage notify={notify} />}
        {route === "notifications" && <NotificationsPage notify={notify} />}
        {route === "settings" && <SettingsPage notify={notify} />}

        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
}
