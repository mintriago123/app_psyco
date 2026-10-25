"use client";

import { useEffect, useRef } from "react";
import type { GameSessionState } from "../../types/spec";
import { upsertProgress } from "../lib/supabase/progress.service";

export interface GameExitGuardOptions {
  userId: string | null;
  session: GameSessionState | null;
  enabled?: boolean;
}

/** Persiste snapshots y solicita confirmación nativa al salir de una partida. */
export function useGameExitGuard({
  userId,
  session,
  enabled = true,
}: GameExitGuardOptions): void {
  const latestState = useRef({ userId, session });
  latestState.current = { userId, session };

  const active = enabled && Boolean(userId && session?.phase === "active");

  useEffect(() => {
    if (!enabled || !userId || !session) return;
    void upsertProgress(userId, { active_game_session: session });
  }, [enabled, userId, session]);

  useEffect(() => {
    if (!active) return;

    const guardedUrl = window.location.href;
    const persistLatestSession = () => {
      const latest = latestState.current;
      if (!latest.userId || !latest.session) return;
      void upsertProgress(latest.userId, {
        active_game_session: latest.session,
      });
    };

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
