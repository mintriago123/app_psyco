"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { SessionHookState } from "../hooks/useSession";
import type { ProgressHookState } from "../hooks/useProgress";
import { useProgress } from "../hooks/useProgress";
import { useSession } from "../hooks/useSession";

type AppState = SessionHookState & ProgressHookState & {
  setSession: (session: Session | null) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const sessionState = useSession();
  const [sessionOverride, setSessionOverride] = useState<Session | null | undefined>(undefined);
  const previousHookSession = useRef(sessionState.session);

  useEffect(() => {
    if (previousHookSession.current === sessionState.session) return;
    previousHookSession.current = sessionState.session;
    setSessionOverride(sessionState.session);
  }, [sessionState.session]);

  const session = sessionOverride === undefined ? sessionState.session : sessionOverride;
  const user = session?.user ?? null;
  const progressState = useProgress(user?.id ?? null);

  return (
    <AppStateContext.Provider value={{
      ...sessionState,
      ...progressState,
      session,
      user,
      setSession: setSessionOverride,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error("useAppState debe usarse dentro de AppProviders.");
  return state;
}
