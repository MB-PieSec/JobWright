import { useCallback, useEffect, useState } from "react";

export const ROUTES = [
  "overview",
  "jobs",
  "runs",
  "resume",
  "ai",
  "notifications",
  "settings",
] as const;

export type Route = (typeof ROUTES)[number];

function parseHash(hash: string): Route {
  const value = hash.replace(/^#\/?/, "").split("?")[0];
  return (ROUTES as readonly string[]).includes(value)
    ? (value as Route)
    : "overview";
}

/**
 * Tiny hash router. Hash routing keeps the built SPA working when Fastify
 * serves it from any path without server-side route configuration.
 */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash),
  );

  useEffect(() => {
    const handleChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handleChange);
    return () => window.removeEventListener("hashchange", handleChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (parseHash(window.location.hash) === next) {
      setRoute(next);
      return;
    }
    window.location.hash = `#/${next}`;
  }, []);

  return [route, navigate];
}
