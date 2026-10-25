"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserProgressDB } from "../../types/spec";
import { getProgress } from "../lib/supabase/progress.service";

export interface ProgressHookState {
  progress: UserProgressDB | null;
  loading: boolean;
  error: Error | null;
  refreshProgress: () => Promise<void>;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "No se pudo cargar el progreso.");
}

export function useProgress(userId: string | null): ProgressHookState {
  const [progress, setProgress] = useState<UserProgressDB | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);

  const refreshProgress = useCallback(async () => {
    const currentRequestId = ++requestId.current;

    if (!userId) {
      setProgress(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextProgress = await getProgress(userId);
      if (requestId.current === currentRequestId) setProgress(nextProgress);
    } catch (loadError) {
      if (requestId.current === currentRequestId) setError(toError(loadError));
    } finally {
      if (requestId.current === currentRequestId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshProgress();
    return () => {
      requestId.current += 1;
    };
  }, [refreshProgress]);

  return { progress, loading, error, refreshProgress };
}
