import type { GameSessionState } from "../../types/spec";
import {
  addToErrorVault,
  getProgress,
  updateAfterVictory,
  upsertProgress,
  type ProgressMutationResult,
} from "./supabase/progress.service";

function errorResult(error: unknown): ProgressMutationResult {
  return {
    error:
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "No se pudo guardar el resultado."),
  };
}

/** Persiste el resultado cerrado y los errores que deben quedar en el Baúl. */
export async function persistFinishedSession(
  userId: string,
  session: GameSessionState,
): Promise<ProgressMutationResult> {
  if (session.phase === "active") {
    return { error: new Error("La partida todavía no tiene un resultado final.") };
  }

  for (const questionId of session.failedQuestionIds) {
    const { error } = await addToErrorVault(userId, questionId);
    if (error) return { error };
  }

  if (session.phase === "won") {
    const snapshotResult = await upsertProgress(userId, {
      active_game_session: session,
    });
    if (snapshotResult.error) return snapshotResult;

    return updateAfterVictory(userId, session.unitId, {
      xpEarned: session.earnedXp,
      maxCombo: session.bestCombo,
    });
  }

  let progress;
  try {
    progress = await getProgress(userId);
  } catch (error) {
    return errorResult(error);
  }

  if (!progress) {
    return { error: new Error("No se encontró el progreso para guardar la partida.") };
  }

  const statistics = progress.statistics;
  const nextStatistics = {
    ...statistics,
    gamesLost: statistics.gamesLost + 1,
    questionsAnswered: statistics.questionsAnswered + session.totalAttempts,
    correctAnswers: statistics.correctAnswers + session.correctAnswers,
    incorrectAnswers:
      statistics.incorrectAnswers +
      Math.max(0, session.totalAttempts - session.correctAnswers),
    bestCombo: Math.max(statistics.bestCombo, session.bestCombo),
  };

  return upsertProgress(userId, {
    active_game_session: session,
    total_xp: progress.total_xp + session.earnedXp,
    statistics: nextStatistics,
  });
}
