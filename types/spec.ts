/**
 * Contratos compartidos por el banco estático, el motor de partidas y
 * la persistencia de progreso descritos en la especificación.
 */

export const UNIT_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type UnitId = (typeof UNIT_IDS)[number];

export type ModuleId = 1 | 2;

export interface StudyModule {
  id: ModuleId;
  title: string;
  unitIds: UnitId[];
}

export interface StudyUnit {
  id: UnitId;
  moduleId: ModuleId;
  title: string;
  order: number;
}

export type QuestionFormat =
  | "multiple_choice"
  | "clinical_case"
  | "true_false";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface ClinicalHint {
  /** Texto exacto que el motor resaltará dentro del enunciado. */
  highlightText: string;
}

export interface QuestionBase {
  id: string;
  unitId: UnitId;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  /** Página del documento oficial que respalda respuesta y explicación. */
  sourcePage: number;
}

export interface MultipleChoiceQuestion extends QuestionBase {
  format: "multiple_choice";
  hint?: never;
}

export interface ClinicalCaseQuestion extends QuestionBase {
  format: "clinical_case";
  /** La pista es obligatoria para que el caso se pueda incluir en el banco. */
  hint: ClinicalHint;
}

export interface TrueFalseQuestion extends QuestionBase {
  format: "true_false";
  options: [QuestionOption, QuestionOption];
  hint?: never;
}

export type Question =
  | MultipleChoiceQuestion
  | ClinicalCaseQuestion
  | TrueFalseQuestion;

export interface ComparativeTable {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface KeyNotes {
  unitId: UnitId;
  title: string;
  summary: string;
  definitions: Array<{
    term: string;
    definition: string;
  }>;
  comparativeTables: ComparativeTable[];
  sourcePages: number[];
}

export type MasteryLevel = "none" | "bronze" | "silver" | "gold";

export interface UnitProgress {
  completionCount: number;
  mastery: MasteryLevel;
}

export type MedalId =
  | "ojo-clinico"
  | "semiologo-experto"
  | "combo-imparable";

export interface UserStatistics {
  gamesStarted: number;
  gamesWon: number;
  gamesLost: number;
  questionsAnswered: number;
  correctAnswers: number;
  incorrectAnswers: number;
  bestCombo: number;
}

export interface SessionQuestion {
  /** Identifica la aparición, no solo la pregunta del banco. */
  instanceId: string;
  questionId: string;
  /** IDs en el orden aleatorio mostrado durante esta aparición. */
  optionOrder: string[];
  isRepeat: boolean;
  hintUsed: boolean;
}

export type GamePhase = "active" | "won" | "out_of_lives";

export type AnswerOutcome = "correct" | "incorrect";

export interface AnswerFeedback {
  outcome: AnswerOutcome;
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  explanation: string;
  sourcePage: number;
  xpAwarded: number;
  livesLost: number;
}

export interface GameSessionState {
  unitId: UnitId;
  phase: GamePhase;
  lives: number;
  readonly startingLives: 5;
  questionQueue: SessionQuestion[];
  currentQuestionIndex: number;
  initialQuestionCount: number;
  /** Únicos IDs resueltos correctamente; sirve para la barra de progreso. */
  completedQuestionIds: string[];
  /** IDs únicos fallados, disponibles para el Baúl y la pantalla de repaso. */
  failedQuestionIds: string[];
  totalAttempts: number;
  correctAnswers: number;
  earnedXp: number;
  currentCombo: number;
  bestCombo: number;
  feedback: AnswerFeedback | null;
  /** Estado interno para que nuevas apariciones también sean reproducibles. */
  randomSeed: number;
}

export interface SessionSummary {
  unitId: UnitId;
  outcome: "won" | "out_of_lives";
  accuracyPercent: number;
  xpEarned: number;
  bestCombo: number;
  livesRemaining: number;
  failedQuestionIds: string[];
}

/** Forma de la fila de public.user_progress, con nombres SQL originales. */
export interface UserProgressDB {
  user_id: string;
  total_xp: number;
  unlocked_unit_ids: UnitId[];
  unit_progress: Record<UnitId, UnitProgress>;
  error_chest_question_ids: string[];
  unlocked_medals: MedalId[];
  statistics: UserStatistics;
  active_game_session: GameSessionState | null;
  created_at: string;
  updated_at: string;
}
