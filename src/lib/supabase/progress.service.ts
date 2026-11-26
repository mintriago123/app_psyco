"use client";

import type {
  GameSessionState,
  PersistedGameSession,
  UserProgressDB,
} from "../../../types/spec";
import { createClient } from "./client";

export async function getProgress(userId: string): Promise<UserProgressDB | null> {
  const { data, error } = await createClient()
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function startGameSession(
  userId: string,
  session: GameSessionState,
): Promise<PersistedGameSession> {
  const { data, error } = await createClient().rpc("start_game_session", {
    p_user_id: userId,
    p_session: session,
  });
  if (error) throw error;
  return data;
}

export async function saveGameSnapshot(userId: string, session: PersistedGameSession): Promise<void> {
  const { error } = await createClient().rpc("save_game_snapshot", {
    p_user_id: userId,
    p_session: session,
  });
  if (error) throw error;
}

export async function persistFinishedSession(
  userId: string,
  session: PersistedGameSession,
): Promise<PersistedGameSession> {
  const { data, error } = await createClient().rpc("finish_game_session", {
    p_user_id: userId,
    p_session_id: session.sessionId,
    p_result: session,
  });
  if (error) throw error;
  return data;
}

async function changeErrorVault(userId: string, questionId: string | number, add: boolean) {
  try {
    const { error } = await createClient().rpc("change_error_vault", {
      p_user_id: userId,
      p_question_id: String(questionId),
      p_add: add,
    });
    return { error };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("No se pudo actualizar el Baúl.") };
  }
}

export function addToErrorVault(userId: string, questionId: string | number) {
  return changeErrorVault(userId, questionId, true);
}

export function removeFromErrorVault(userId: string, questionId: string | number) {
  return changeErrorVault(userId, questionId, false);
}
