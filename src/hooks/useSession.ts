"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { onAuthStateChange } from "../lib/supabase/auth.service";

export interface SessionHookState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useSession(): SessionHookState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data, error } = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    if (error) setLoading(false);

    return () => {
      data?.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
