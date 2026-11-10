import { useCallback, useEffect, useState } from "react";
import { fetchJobs } from "../api";
import type { Filters, JobsResponse } from "../types";

interface JobsState {
  data: JobsResponse | null;
  loading: boolean;
  error: string | null;
}

export function useJobs(filters: Filters, limit: number, offset: number) {
  const [state, setState] = useState<JobsState>({
    data: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setState((previous) => ({ ...previous, loading: true, error: null }));

    fetchJobs(filters, limit, offset, controller.signal)
      .then((data) => {
        setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setState((previous) => ({
          data: previous.data,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      });

    return () => controller.abort();
  }, [filters, limit, offset, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { ...state, reload };
}
