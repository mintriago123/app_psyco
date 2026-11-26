import type { GameSessionState, PersistedGameSession, UnitId } from "../../types/spec";

let inMemoryResult: { key: string; session: PersistedGameSession } | null = null;

function resultKey(userId: string, unitId: UnitId): string {
  return `app-psyco:game-result:${userId}:${unitId}`;
}

function isGameResult(value: unknown): value is PersistedGameSession {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<PersistedGameSession>;
  return (
    typeof candidate.sessionId === "string" &&
    Number.isInteger(candidate.revision) &&
    Number.isInteger(candidate.unitId) &&
    candidate.startingLives === 5 &&
    (candidate.phase === "won" || candidate.phase === "out_of_lives") &&
    Array.isArray(candidate.questionQueue) &&
    Array.isArray(candidate.completedQuestionIds) &&
    Array.isArray(candidate.failedQuestionIds) &&
    typeof candidate.earnedXp === "number"
  );
}

export function getFinishedGame(session: GameSessionState | null | undefined): PersistedGameSession | null {
  return isGameResult(session) ? session : null;
}

export function storeGameResult(userId: string, session: PersistedGameSession): void {
  const key = resultKey(userId, session.unitId);
  inMemoryResult = { key, session };

  try {
    window.sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    // La navegación de la pestaña puede recuperar el resultado desde memoria.
  }
}

export function readGameResult(userId: string, unitId: UnitId): PersistedGameSession | null {
  const key = resultKey(userId, unitId);
  if (inMemoryResult?.key === key) return inMemoryResult.session;

  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    return isGameResult(value) && value.unitId === unitId ? value : null;
  } catch {
    return null;
  }
}
