"use client";

import type {
  MasteryLevel,
  UnitId,
  UserProgressDB,
  UserStatistics,
} from "../../../types/spec";
import { evaluateMedals } from "../medals";
import { createClient } from "./client";

export interface VictoryResult {
  xpEarned: number;
  maxCombo: number;
}

export interface ProgressMutationResult {
  error: Error | null;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Error al guardar el progreso.");
}

/** Lee la única fila del usuario autenticado; los errores se propagan al hook. */
export async function getProgress(
  userId: string,
): Promise<UserProgressDB | null> {
  const { data, error } = await createClient()
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertProgress(
  userId: string,
  progress: Partial<UserProgressDB>,
): Promise<ProgressMutationResult> {
  try {
    const { error } = await createClient()
      .from("user_progress")
      .upsert({ ...progress, user_id: userId }, { onConflict: "user_id" });
    return { error };
  } catch (error) {
    return { error: toError(error) };
  }
}

/** Acepta número por el contrato operativo y string por los IDs del banco. */
export function addToErrorVault(
  userId: string,
  questionId: number,
): Promise<ProgressMutationResult>;
export function addToErrorVault(
  userId: string,
  questionId: string,
): Promise<ProgressMutationResult>;
export async function addToErrorVault(
  userId: string,
  questionId: number | string,
): Promise<ProgressMutationResult> {
  let progress: UserProgressDB | null;
  try {
    progress = await getProgress(userId);
  } catch (error) {
    return { error: toError(error) };
  }

  const questionIds = new Set(progress?.error_chest_question_ids ?? []);
  questionIds.add(String(questionId));
  return upsertProgress(userId, {
    error_chest_question_ids: [...questionIds],
  });
}

export function removeFromErrorVault(
  userId: string,
  questionId: number,
): Promise<ProgressMutationResult>;
export function removeFromErrorVault(
  userId: string,
  questionId: string,
): Promise<ProgressMutationResult>;
export async function removeFromErrorVault(
  userId: string,
  questionId: number | string,
): Promise<ProgressMutationResult> {
  let progress: UserProgressDB | null;
  try {
    progress = await getProgress(userId);
  } catch (error) {
    return { error: toError(error) };
  }

  if (!progress) return { error: null };

  return upsertProgress(userId, {
    error_chest_question_ids: progress.error_chest_question_ids.filter(
      (storedQuestionId) => storedQuestionId !== String(questionId),
    ),
  });
}

function masteryForCompletion(completionCount: number): MasteryLevel {
  if (completionCount >= 3) return "gold";
  if (completionCount === 2) return "silver";
  if (completionCount === 1) return "bronze";
  return "none";
}

function statisticsAfterVictory(
  statistics: UserStatistics,
  result: VictoryResult,
  unitId: UnitId,
  session: UserProgressDB["active_game_session"],
): UserStatistics {
  const completedSession =
    session?.phase === "won" && session.unitId === unitId ? session : null;
  const questionsAnswered = completedSession?.totalAttempts ?? 0;
  const correctAnswers = completedSession?.correctAnswers ?? 0;

  return {
    ...statistics,
    gamesWon: statistics.gamesWon + 1,
    questionsAnswered: statistics.questionsAnswered + questionsAnswered,
    correctAnswers: statistics.correctAnswers + correctAnswers,
    incorrectAnswers:
      statistics.incorrectAnswers + Math.max(0, questionsAnswered - correctAnswers),
    bestCombo: Math.max(statistics.bestCombo, result.maxCombo),
  };
}

/**
 * Actualiza XP y maestría al ganar. `completionCount` es el contador de
 * lecciones completadas por unidad del esquema SQL; `statistics.bestCombo`
 * guarda la mejor racha global (no hay columnas escalares con esos nombres).
 */
export async function updateAfterVictory(
  userId: string,
  unitId: UnitId,
  sessionResult: VictoryResult,
): Promise<ProgressMutationResult> {
  let current: UserProgressDB | null;
  try {
    current = await getProgress(userId);
  } catch (error) {
    return { error: toError(error) };
  }

  if (!current) {
    return {
      error: new Error(`No existe progreso en la nube para el usuario ${userId}.`),
    };
  }

  if (
    !Number.isFinite(sessionResult.xpEarned) ||
    sessionResult.xpEarned < 0 ||
    !Number.isFinite(sessionResult.maxCombo) ||
    sessionResult.maxCombo < 0
  ) {
    return { error: new Error("El resultado de la partida contiene valores inválidos.") };
  }

  const currentUnitProgress = current.unit_progress[unitId] ?? {
    completionCount: 0,
    mastery: "none" as const,
  };
  const completionCount = currentUnitProgress.completionCount + 1;
  const unitProgress: UserProgressDB["unit_progress"] = {
    ...current.unit_progress,
    [unitId]: {
      completionCount,
      mastery: masteryForCompletion(completionCount),
    },
  };
  const unlockedUnitIds = new Set<UnitId>(current.unlocked_unit_ids);
  if (unitId < 8) unlockedUnitIds.add((unitId + 1) as UnitId);

  const statistics = statisticsAfterVictory(
    current.statistics,
    sessionResult,
    unitId,
    current.active_game_session,
  );
  const candidateProgress: UserProgressDB = {
    ...current,
    total_xp: current.total_xp + sessionResult.xpEarned,
    unlocked_unit_ids: [...unlockedUnitIds].sort((left, right) => left - right),
    unit_progress: unitProgress,
    statistics,
  };
  candidateProgress.unlocked_medals = [
    ...new Set([
      ...current.unlocked_medals,
      ...evaluateMedals(candidateProgress),
    ]),
  ];

  return upsertProgress(userId, {
    total_xp: candidateProgress.total_xp,
    unlocked_unit_ids: candidateProgress.unlocked_unit_ids,
    unit_progress: candidateProgress.unit_progress,
    statistics: candidateProgress.statistics,
    unlocked_medals: candidateProgress.unlocked_medals,
  });
}
