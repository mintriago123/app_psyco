import type {
  AnswerFeedback,
  GameSessionState,
  Question,
  SessionQuestion,
  SessionSummary,
  UnitId,
} from "../types/spec";

export const STARTING_LIVES = 5;
export const BASE_XP = 10;
export const ASSISTED_XP = 5;
export const COMBO_THRESHOLD = 3;
export const COMBO_BONUS_XP = 5;
export const MIN_QUESTIONS_PER_SESSION = 5;
export const MAX_QUESTIONS_PER_SESSION = 7;

export interface CreateGameSessionInput {
  unitId: UnitId;
  questions: Question[];
  /** Semilla que hace reproducibles la selección y el orden de respuestas. */
  seed: number;
}

export interface TextSegment {
  text: string;
  highlighted: boolean;
}

interface RandomStep {
  value: number;
  seed: number;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new RangeError("La semilla debe ser un entero finito.");
  }

  return seed >>> 0;
}

/** PRNG determinista local; no lee ni modifica estado global. */
function nextRandom(seed: number): RandomStep {
  const nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let value = nextSeed;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  value = (value ^ (value >>> 14)) >>> 0;

  return { value: value / 0x100000000, seed: nextSeed };
}

function randomInteger(seed: number, min: number, max: number): RandomStep & { integer: number } {
  const step = nextRandom(seed);
  return {
    ...step,
    integer: min + Math.floor(step.value * (max - min + 1)),
  };
}

function shuffleWithSeed<T>(items: T[], initialSeed: number): { items: T[]; seed: number } {
  const shuffled = [...items];
  let seed = initialSeed;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const step = randomInteger(seed, 0, index);
    seed = step.seed;
    [shuffled[index], shuffled[step.integer]] = [shuffled[step.integer], shuffled[index]];
  }

  return { items: shuffled, seed };
}

function validateQuestion(question: Question): void {
  if (question.id.trim().length === 0) {
    throw new Error("Cada pregunta debe tener un ID no vacío.");
  }

  if (!Number.isInteger(question.sourcePage) || question.sourcePage < 1) {
    throw new Error(`La pregunta ${question.id} debe citar una página válida.`);
  }

  if (question.options.length < 2) {
    throw new Error(`La pregunta ${question.id} requiere al menos dos opciones.`);
  }

  const optionIds = question.options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) {
    throw new Error(`La pregunta ${question.id} tiene IDs de opción duplicados.`);
  }

  if (!optionIds.includes(question.correctOptionId)) {
    throw new Error(`La respuesta correcta de ${question.id} no existe entre sus opciones.`);
  }

  if (question.format === "true_false" && question.options.length !== 2) {
    throw new Error(`La pregunta verdadero/falso ${question.id} debe tener dos opciones.`);
  }

  if (question.format === "clinical_case") {
    if (!question.hint || question.hint.highlightText.trim().length === 0) {
      throw new Error(`El caso clínico ${question.id} requiere una pista resaltable.`);
    }
    if (!question.prompt.includes(question.hint.highlightText)) {
      throw new Error(`La pista de ${question.id} debe aparecer literalmente en el enunciado.`);
    }
  }
}

/**
 * Crea una partida de entre 5 y 7 preguntas, sin repetir en la selección
 * inicial, y mezcla el orden de sus opciones de forma reproducible.
 */
export function createGameSession(input: CreateGameSessionInput): GameSessionState {
  const seed = normalizeSeed(input.seed);
  const questions = input.questions.filter((question) => question.unitId === input.unitId);

  if (questions.length < MAX_QUESTIONS_PER_SESSION) {
    throw new Error(
      `La unidad ${input.unitId} debe tener al menos ${MAX_QUESTIONS_PER_SESSION} preguntas para iniciar una partida.`,
    );
  }

  const questionIds = questions.map((question) => question.id);
  if (new Set(questionIds).size !== questionIds.length) {
    throw new Error(`La unidad ${input.unitId} contiene IDs de pregunta duplicados.`);
  }

  questions.forEach(validateQuestion);

  const countStep = randomInteger(seed, MIN_QUESTIONS_PER_SESSION, MAX_QUESTIONS_PER_SESSION);
  const selection = shuffleWithSeed(questions, countStep.seed);
  const selectedQuestions = selection.items.slice(0, countStep.integer);
  let randomSeed = selection.seed;

  const questionQueue: SessionQuestion[] = selectedQuestions.map((question, index) => {
    const options = shuffleWithSeed(
      question.options.map((option) => option.id),
      randomSeed,
    );
    randomSeed = options.seed;

    return {
      instanceId: `initial-${index + 1}`,
      questionId: question.id,
      optionOrder: options.items,
      isRepeat: false,
      hintUsed: false,
    };
  });

  return {
    unitId: input.unitId,
    phase: "active",
    lives: STARTING_LIVES,
    startingLives: STARTING_LIVES,
    questionQueue,
    currentQuestionIndex: 0,
    initialQuestionCount: selectedQuestions.length,
    completedQuestionIds: [],
    failedQuestionIds: [],
    totalAttempts: 0,
    correctAnswers: 0,
    earnedXp: 0,
    currentCombo: 0,
    bestCombo: 0,
    feedback: null,
    randomSeed,
  };
}

export function getCurrentSessionQuestion(
  session: GameSessionState,
): SessionQuestion | null {
  if (session.phase !== "active") return null;
  return session.questionQueue[session.currentQuestionIndex] ?? null;
}

/** Marca el uso de la pista de la aparición actual del caso clínico. */
export function revealHint(
  session: GameSessionState,
  question: Question,
): GameSessionState {
  assertCanInteract(session, question);

  if (question.format !== "clinical_case" || !question.hint) {
    throw new Error("La pista solo está disponible en casos clínicos con pista definida.");
  }

  const questionQueue = session.questionQueue.map((item, index) =>
    index === session.currentQuestionIndex ? { ...item, hintUsed: true } : item,
  );

  return { ...session, questionQueue };
}

/** Divide el enunciado para que la interfaz destaque la pista sin HTML dinámico. */
export function getHintSegments(question: Question): TextSegment[] {
  if (!question.hint) return [{ text: question.prompt, highlighted: false }];

  const start = question.prompt.indexOf(question.hint.highlightText);
  if (start < 0) return [{ text: question.prompt, highlighted: false }];

  const end = start + question.hint.highlightText.length;
  const segments: TextSegment[] = [];

  if (start > 0) {
    segments.push({ text: question.prompt.slice(0, start), highlighted: false });
  }
  segments.push({ text: question.prompt.slice(start, end), highlighted: true });
  if (end < question.prompt.length) {
    segments.push({ text: question.prompt.slice(end), highlighted: false });
  }

  return segments;
}

function assertCanInteract(session: GameSessionState, question: Question): SessionQuestion {
  const current = getCurrentSessionQuestion(session);
  if (!current) throw new Error("La partida ya terminó.");
  if (session.feedback) throw new Error("Continúa después de la retroalimentación actual.");
  if (current.questionId !== question.id) {
    throw new Error("La pregunta enviada no coincide con la pregunta actual de la partida.");
  }
  if (question.unitId !== session.unitId) {
    throw new Error("La pregunta pertenece a otra unidad.");
  }
  return current;
}

/**
 * Aplica una respuesta. Los errores restan vida, reinician el combo y ponen
 * la pregunta al final de la cola mientras quede al menos una vida.
 */
export function submitAnswer(
  session: GameSessionState,
  question: Question,
  selectedOptionId: string,
): GameSessionState {
  const current = assertCanInteract(session, question);
  if (!question.options.some((option) => option.id === selectedOptionId)) {
    throw new Error(`La opción ${selectedOptionId} no pertenece a ${question.id}.`);
  }

  const totalAttempts = session.totalAttempts + 1;
  const isCorrect = selectedOptionId === question.correctOptionId;

  if (!isCorrect) {
    const lives = session.lives - 1;
    const failedQuestionIds = session.failedQuestionIds.includes(question.id)
      ? session.failedQuestionIds
      : [...session.failedQuestionIds, question.id];
    const feedback: AnswerFeedback = {
      outcome: "incorrect",
      questionId: question.id,
      selectedOptionId,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
      sourcePage: question.sourcePage,
      xpAwarded: 0,
      livesLost: 1,
    };

    if (lives === 0) {
      return {
        ...session,
        phase: "out_of_lives",
        lives,
        failedQuestionIds,
        totalAttempts,
        currentCombo: 0,
        feedback,
      };
    }

    const repeatedQuestion: SessionQuestion = {
      instanceId: `repeat-${session.questionQueue.length + 1}`,
      questionId: question.id,
      optionOrder: [...current.optionOrder],
      isRepeat: true,
      hintUsed: false,
    };

    return {
      ...session,
      lives,
      questionQueue: [...session.questionQueue, repeatedQuestion],
      failedQuestionIds,
      totalAttempts,
      currentCombo: 0,
      feedback,
    };
  }

  const hasPreviouslyFailed = session.failedQuestionIds.includes(question.id);
  const isEligibleComboAnswer = !current.isRepeat && !current.hintUsed && !hasPreviouslyFailed;
  const currentCombo = isEligibleComboAnswer ? session.currentCombo + 1 : session.currentCombo;
  const comboBonus = isEligibleComboAnswer && currentCombo >= COMBO_THRESHOLD
    ? COMBO_BONUS_XP
    : 0;
  const xpAwarded = isEligibleComboAnswer ? BASE_XP + comboBonus : ASSISTED_XP;
  const completedQuestionIds = session.completedQuestionIds.includes(question.id)
    ? session.completedQuestionIds
    : [...session.completedQuestionIds, question.id];
  const nextQuestionIndex = session.currentQuestionIndex + 1;
  const hasWon = nextQuestionIndex >= session.questionQueue.length;

  return {
    ...session,
    phase: hasWon ? "won" : "active",
    currentQuestionIndex: nextQuestionIndex,
    completedQuestionIds,
    totalAttempts,
    correctAnswers: session.correctAnswers + 1,
    earnedXp: session.earnedXp + xpAwarded,
    currentCombo,
    bestCombo: Math.max(session.bestCombo, currentCombo),
    feedback: null,
  };
}

/** Avanza tras mostrar una respuesta incorrecta y su explicación/página. */
export function continueAfterFeedback(session: GameSessionState): GameSessionState {
  if (session.phase !== "active") {
    throw new Error("No se puede continuar una partida terminada.");
  }
  if (!session.feedback || session.feedback.outcome !== "incorrect") {
    throw new Error("No hay retroalimentación incorrecta pendiente.");
  }

  return {
    ...session,
    currentQuestionIndex: session.currentQuestionIndex + 1,
    feedback: null,
  };
}

/** Progreso de preguntas únicas resueltas; un error nunca lo hace avanzar. */
export function getProgressPercent(session: GameSessionState): number {
  if (session.initialQuestionCount === 0) return 0;
  return Math.round((session.completedQuestionIds.length / session.initialQuestionCount) * 100);
}

/** Precisión = respuestas correctas divididas para todos los intentos enviados. */
export function getSessionSummary(session: GameSessionState): SessionSummary {
  if (session.phase === "active") {
    throw new Error("El resumen solo está disponible al finalizar la partida.");
  }

  const accuracyPercent = session.totalAttempts === 0
    ? 0
    : Math.round((session.correctAnswers / session.totalAttempts) * 100);

  return {
    unitId: session.unitId,
    outcome: session.phase,
    accuracyPercent,
    xpEarned: session.earnedXp,
    bestCombo: session.bestCombo,
    livesRemaining: session.lives,
    failedQuestionIds: [...session.failedQuestionIds],
  };
}
