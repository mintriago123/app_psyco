import type { MedalId, UserProgressDB } from "../../types/spec";

/**
 * Evalúa los únicos criterios de medalla aprobados en Spec 07.
 * El resultado puede unirse a `unlocked_medals` antes de persistir el progreso.
 */
export function evaluateMedals(progress: UserProgressDB): MedalId[] {
  const medals: MedalId[] = [];
  const lastSession = progress.active_game_session;

  if (
    lastSession?.phase === "won" &&
    lastSession.lives === lastSession.startingLives &&
    lastSession.totalAttempts > 0 &&
    lastSession.correctAnswers === lastSession.totalAttempts
  ) {
    medals.push("ojo-clinico");
  }

  const allSemiologyUnitsAtGold = ([1, 2, 3, 4, 5] as const).every(
    (unitId) => progress.unit_progress[unitId]?.mastery === "gold",
  );

  if (allSemiologyUnitsAtGold) {
    medals.push("semiologo-experto");
  }

  if (progress.statistics.bestCombo >= 5) {
    medals.push("combo-imparable");
  }

  return medals;
}
