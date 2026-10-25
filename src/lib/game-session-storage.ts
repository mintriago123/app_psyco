import type { GameSessionState, UnitId } from "../../types/spec";

const RESULT_SESSION_KEY = "app-psyco:game-result";

function isGameSessionState(value: unknown): value is GameSessionState {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<GameSessionState>;
  return (
    Number.isInteger(candidate.unitId) &&
    candidate.startingLives === 5 &&
    (candidate.phase === "won" || candidate.phase === "out_of_lives") &&
    Array.isArray(candidate.questionQueue) &&
    Array.isArray(candidate.failedQuestionIds) &&
    typeof candidate.earnedXp === "number" &&
    typeof candidate.randomSeed === "number"
  );
}

export function storeGameResult(session: GameSessionState): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(RESULT_SESSION_KEY, JSON.stringify(session));
}

export function readGameResult(unitId: UnitId): GameSessionState | null {
  if (typeof window === "undefined") return null;

  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(RESULT_SESSION_KEY) ?? "null",
    );
    if (!isGameSessionState(value) || value.unitId !== unitId) return null;
    return value;
  } catch {
    return null;
  }
}

export function getResultPersistenceKey(session: GameSessionState): string {
  return `app-psyco:result-saved:${session.unitId}:${session.randomSeed}:${session.totalAttempts}:${session.earnedXp}`;
}
