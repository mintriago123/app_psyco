"use client";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createClient } from "./client";

export type AuthOperationError = Error;

export interface AuthCredentialsData {
  user: User | null;
  session: Session | null;
}

export interface AuthSessionData {
  session: Session | null;
}

export interface AuthSubscription {
  unsubscribe(): void;
}

export type AuthChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

function toError(error: unknown): AuthOperationError {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Error de autenticación.");
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ data: AuthCredentialsData | null; error: AuthOperationError | null }> {
  try {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      ...(origin
        ? { options: { emailRedirectTo: `${origin}/auth/callback` } }
        : {}),
    });
    return { data, error };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ data: AuthCredentialsData | null; error: AuthOperationError | null }> {
  try {
    const { data, error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}

/** Envía el enlace de recuperación y vuelve al callback de Auth de la app. */
export async function requestPasswordReset(
  email: string,
): Promise<{ error: AuthOperationError | null }> {
  try {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
    if (!origin) {
      return { error: new Error("No se pudo determinar la dirección de la aplicación.") };
    }

    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });
    return { error };
  } catch (error) {
    return { error: toError(error) };
  }
}

/** Actualiza la contraseña del usuario de la sesión activa. */
export async function updatePassword(
  password: string,
): Promise<{ error: AuthOperationError | null }> {
  try {
    const { error } = await createClient().auth.updateUser({ password });
    return { error };
  } catch (error) {
    return { error: toError(error) };
  }
}

export async function signOut(): Promise<{
  data: null;
  error: AuthOperationError | null;
}> {
  try {
    const { error } = await createClient().auth.signOut();
    return { data: null, error };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}

export async function getSession(): Promise<{
  data: AuthSessionData;
  error: AuthOperationError | null;
}> {
  try {
    const { data, error } = await createClient().auth.getSession();
    return { data, error };
  } catch (error) {
    return { data: { session: null }, error: toError(error) };
  }
}

export function onAuthStateChange(callback: AuthChangeCallback): {
  data: { subscription: AuthSubscription } | null;
  error: AuthOperationError | null;
} {
  try {
    const { data } = createClient().auth.onAuthStateChange(callback);
    return { data, error: null };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}
