"use client";

import { useEffect, useEffectEvent } from "react";
import type { PersistedGameSession } from "../../types/spec";
import { saveGameSnapshot } from "../lib/supabase/progress.service";

export interface GameExitGuardOptions {
  userId: string | null;
  session: PersistedGameSession | null;
  enabled?: boolean;
}

export function useGameExitGuard({
  userId,
  session,
  enabled = true,
}: GameExitGuardOptions): void {
  const active = enabled && Boolean(userId && session?.phase === "active");

  const persistLatestSession = useEffectEvent(() => {
    if (!enabled || !userId || session?.phase !== "active") return;
    void saveGameSnapshot(userId, session).catch(() => {
      // El siguiente snapshot vuelve a enviar todo el avance activo.
    });
  });

  useEffect(() => {
    persistLatestSession();
  }, [enabled, userId, session]);

  useEffect(() => {
    if (!active) return;

    const guardedUrl = window.location.href;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      persistLatestSession();
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      const shouldLeave = window.confirm(
        "La partida está en curso. ¿Quieres salir? Se intentará guardar el progreso.",
      );
      if (!shouldLeave) {
        window.history.pushState({ gameExitGuard: true }, "", guardedUrl);
        return;
      }
      persistLatestSession();
    };

    window.history.pushState({ gameExitGuard: true }, "", guardedUrl);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [active]);
}
