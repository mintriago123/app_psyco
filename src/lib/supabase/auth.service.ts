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
    const { data, error } = await createClient().auth.signUp({ email, password });
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
