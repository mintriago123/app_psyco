import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  continueAfterFeedback,
  createGameSession,
  getCurrentSessionQuestion,
  getHintSegments,
  getProgressPercent,
  getSessionSummary,
  revealHint,
  submitAnswer,
} from "../lib/game-engine";
import type {
  GameSessionState,
  KeyNotes,
  Question,
  QuestionFormat,
  UnitId,
} from "../types/spec";

const root = process.cwd();
const questionData: unknown = JSON.parse(
  readFileSync(join(root, "data/questions_bank.json"), "utf8"),
);
const notesData: unknown = JSON.parse(
  readFileSync(join(root, "data/key_notes.json"), "utf8"),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} debe ser un texto no vacío`);
  }
  return value;
}

function requireInteger(value: unknown, label: string, min: number, max?: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    (max !== undefined && value > max)
  ) {
    throw new Error(`${label} debe ser un entero dentro del rango permitido`);
  }
  return value;
}

function assertQuestion(value: unknown, index: number): asserts value is Question {
  assert.ok(isRecord(value), `question[${index}] debe ser un objeto`);
  const id = requireString(value.id, `question[${index}].id`);
  const unitId = requireInteger(value.unitId, `question[${index}].unitId`, 1, 8);
  assert.ok(
    value.format === "multiple_choice" ||
      value.format === "clinical_case" ||
      value.format === "true_false",
    `question[${index}].format válido`,
  );
  const prompt = requireString(value.prompt, `${id}.prompt`);
  const explanation = requireString(value.explanation, `${id}.explanation`);
  const sourcePage = requireInteger(value.sourcePage, `${id}.sourcePage`, 1);
  assert.ok(Array.isArray(value.options) && value.options.length >= 2);

  const optionIds: string[] = [];
  for (const option of value.options) {
    assert.ok(isRecord(option));
    optionIds.push(requireString(option.id, `${id}.option.id`));
    requireString(option.text, `${id}.option.text`);
  }
  assert.equal(new Set(optionIds).size, optionIds.length, `IDs de opción únicos: ${id}`);
  const correctOptionId = requireString(value.correctOptionId, `${id}.correctOptionId`);
  assert.ok(optionIds.includes(correctOptionId), `opción correcta: ${id}`);

  if (value.format === "true_false") {
    assert.equal(value.options.length, 2, `V/F tiene dos opciones: ${value.id}`);
  }

  if (value.format === "clinical_case") {
    assert.ok(isRecord(value.hint), `caso clínico tiene hint: ${id}`);
    const highlightText = requireString(value.hint.highlightText, `${id}.hint.highlightText`);
    assert.ok(prompt.includes(highlightText), `la pista aparece literalmente en prompt: ${id}`);
  } else {
    assert.equal(value.hint, undefined, `solo clinical_case puede tener pista: ${id}`);
  }

  const expectedSourceMarker = unitId <= 5 ? `p. ${sourcePage}/49` : `p. ${sourcePage}/7`;
  assert.ok(explanation.includes(expectedSourceMarker), `fuente y página: ${id}`);
  assert.ok(sourcePage <= (unitId <= 5 ? 49 : 7), `página dentro del PDF: ${id}`);
}

function assertKeyNotes(value: unknown, index: number): asserts value is KeyNotes {
  assert.ok(isRecord(value), `key_notes[${index}] debe ser un objeto`);
  requireInteger(value.unitId, `key_notes[${index}].unitId`, 1, 8);
  requireString(value.title, `key_notes[${index}].title`);
  requireString(value.summary, `key_notes[${index}].summary`);
  assert.ok(Array.isArray(value.definitions) && value.definitions.length > 0);
  for (const definition of value.definitions) {
    assert.ok(isRecord(definition));
    requireString(definition.term, "definition.term");
    requireString(definition.definition, "definition.definition");
  }
  assert.ok(Array.isArray(value.comparativeTables) && value.comparativeTables.length > 0);
  for (const table of value.comparativeTables) {
    assert.ok(isRecord(table));
    requireString(table.title, "comparativeTable.title");
    assert.ok(Array.isArray(table.columns) && table.columns.length > 0);
    assert.ok(table.columns.every((column) => typeof column === "string" && column.length > 0));
    assert.ok(Array.isArray(table.rows) && table.rows.length > 0);
    for (const row of table.rows) {
      assert.ok(Array.isArray(row));
      assert.equal(row.length, table.columns.length, `tabla rectangular: ${table.title}`);
      assert.ok(row.every((cell) => typeof cell === "string"));
    }
  }
  assert.ok(Array.isArray(value.sourcePages) && value.sourcePages.length > 0);
  assert.ok(value.sourcePages.every((page) => typeof page === "number" && Number.isInteger(page) && page > 0));
  const maximumPage = Number(value.unitId) <= 5 ? 49 : 7;
  assert.ok(value.sourcePages.every((page) => Number(page) <= maximumPage));
}

assert.ok(Array.isArray(questionData), "el banco es un arreglo JSON");
questionData.forEach(assertQuestion);
const questions = questionData as Question[];
assert.equal(questions.length, 75, "el banco contiene exactamente 75 preguntas");
assert.equal(new Set(questions.map((question) => question.id)).size, 75, "IDs globales únicos");

const expectedCounts: Record<UnitId, number> = {
  1: 9,
  2: 10,
  3: 10,
  4: 10,
  5: 10,
  6: 9,
  7: 8,
  8: 9,
};
for (const unitId of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
  const count = questions.filter((question) => question.unitId === unitId).length;
  assert.ok(count >= 7, `unidad ${unitId} tiene al menos 7 preguntas`);
  assert.equal(count, expectedCounts[unitId], `distribución aprobada de unidad ${unitId}`);
}
const formats = new Set(questions.map((question) => question.format));
assert.deepEqual([...formats].sort(), ["clinical_case", "multiple_choice", "true_false"]);
console.log("PASS banco: 75 preguntas, IDs únicos, 8 unidades con distribución aprobada y formatos válidos");

assert.ok(Array.isArray(notesData), "los apuntes son un arreglo JSON");
notesData.forEach(assertKeyNotes);
const notes = notesData as KeyNotes[];
assert.equal(notes.length, 8, "hay apuntes para las ocho unidades");
assert.deepEqual(notes.map((entry) => entry.unitId).sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
console.log("PASS apuntes: 8 entradas válidas con definiciones, tablas y páginas");

function makeQuestions(format: QuestionFormat = "multiple_choice"): Question[] {
  return Array.from({ length: 7 }, (_, index) => {
    const base = {
      id: `fixture-${index + 1}`,
      unitId: 1 as const,
      prompt: `Enunciado de prueba ${index + 1}${format === "clinical_case" ? " clave" : ""}`,
      options: [
        { id: "correct", text: "Respuesta correcta" },
        { id: "wrong-1", text: "Respuesta incorrecta uno" },
        { id: "wrong-2", text: "Respuesta incorrecta dos" },
      ],
      correctOptionId: "correct",
      explanation: "Explicación de prueba con página de origen.",
      sourcePage: 1,
    };

    if (format === "clinical_case") {
      return { ...base, format, hint: { highlightText: "clave" } };
    }
    if (format === "true_false") {
      return {
        ...base,
        format,
        options: [
          { id: "correct", text: "Verdadero" },
          { id: "wrong-1", text: "Falso" },
        ] as [{ id: string; text: string }, { id: string; text: string }],
      };
    }
    return { ...base, format };
  });
}

function newSession(bank = makeQuestions(), seed = 44): GameSessionState {
  return createGameSession({ unitId: 1, questions: bank, seed });
}

function currentQuestion(session: GameSessionState, bank: Question[]): Question {
  const current = getCurrentSessionQuestion(session);
  assert.ok(current, "debe existir pregunta actual");
  const question = bank.find((entry) => entry.id === current.questionId);
  assert.ok(question, "pregunta actual existe en el banco");
  return question;
}

function answerCorrect(session: GameSessionState, bank: Question[]): GameSessionState {
  const question = currentQuestion(session, bank);
  return submitAnswer(session, question, question.correctOptionId);
}

function answerWrong(session: GameSessionState, bank: Question[]): GameSessionState {
  const question = currentQuestion(session, bank);
  const wrongOption = question.options.find((option) => option.id !== question.correctOptionId);
  assert.ok(wrongOption);
  return submitAnswer(session, question, wrongOption.id);
}

// Gherkin: nueva partida, cinco vidas y estado inicial.
{
  const session = newSession();
  assert.equal(session.lives, 5);
  assert.equal(session.earnedXp, 0);
  assert.equal(session.currentCombo, 0);
  assert.ok(session.questionQueue.length >= 5 && session.questionQueue.length <= 7);
  assert.equal(new Set(session.questionQueue.map((item) => item.questionId)).size, session.questionQueue.length);
}
console.log("PASS RF-14: inicio con cinco vidas y selección inicial de 5–7 preguntas únicas");

// Gherkin: primero y segundo acierto limpio valen 10; tercero y posteriores 15.
{
  const bank = makeQuestions();
  let session = newSession(bank);
  session = answerCorrect(session, bank);
  assert.equal(session.earnedXp, 10);
  assert.equal(session.currentCombo, 1);
  session = answerCorrect(session, bank);
  assert.equal(session.earnedXp, 20);
  assert.equal(session.currentCombo, 2);
  session = answerCorrect(session, bank);
  assert.equal(session.earnedXp, 35);
  assert.equal(session.currentCombo, 3);
  assert.equal(session.bestCombo, 3);
  session = answerCorrect(session, bank);
  assert.equal(session.earnedXp, 50);
  assert.equal(session.currentCombo, 4);
}
console.log("PASS RF-13: XP limpio 10; desde el tercer acierto elegible 15; mejor combo actualizado");

// Gherkin: acierto con pista vale 5 y no incrementa el combo.
{
  const bank = makeQuestions("clinical_case");
  let session = newSession(bank);
  session = answerCorrect(session, bank);
  session = answerCorrect(session, bank);
  const question = currentQuestion(session, bank);
  session = revealHint(session, question);
  const segments = getHintSegments(question);
  assert.ok(segments.some((segment) => segment.text === "clave" && segment.highlighted));
  const beforeCombo = session.currentCombo;
  session = submitAnswer(session, question, question.correctOptionId);
  assert.equal(session.earnedXp, 25);
  assert.equal(beforeCombo, 2);
  assert.equal(session.currentCombo, beforeCombo);
}
console.log("PASS RF-11/RF-13: pista resaltada, acierto asistido da 5 XP sin incrementar combo");

// Gherkin: error resta vida, reinicia combo y no avanza progreso.
{
  const bank = makeQuestions();
  let session = newSession(bank);
  session = answerCorrect(session, bank);
  const progressBefore = getProgressPercent(session);
  const attemptsBefore = session.totalAttempts;
  session = answerWrong(session, bank);
  assert.equal(session.lives, 4);
  assert.equal(session.currentCombo, 0);
  assert.equal(session.totalAttempts, attemptsBefore + 1);
  assert.equal(getProgressPercent(session), progressBefore);
  assert.equal(session.feedback?.outcome, "incorrect");
  assert.ok(session.feedback?.correctOptionId);
  assert.ok(session.feedback?.explanation);
  assert.ok(session.feedback?.sourcePage);
  assert.equal(session.questionQueue[session.questionQueue.length - 1]?.isRepeat, true);
  assert.equal(continueAfterFeedback(session).feedback, null);
}
console.log("PASS RF-12/RF-13/RF-14: error reduce vida, combo cero, progreso quieto, feedback y reencolado");

// Gherkin: la pregunta repetida cobra vida si vuelve a fallarse y otorga 5 XP si se acierta.
{
  const bank = makeQuestions();
  let session = answerWrong(newSession(bank), bank);
  session = continueAfterFeedback(session);
  while (session.currentQuestionIndex < session.initialQuestionCount) {
    session = answerCorrect(session, bank);
  }
  const repeated = getCurrentSessionQuestion(session);
  assert.ok(repeated?.isRepeat);
  const comboBeforeRepeat = session.currentCombo;
  const xpBeforeRepeat = session.earnedXp;
  session = answerCorrect(session, bank);
  assert.equal(session.earnedXp - xpBeforeRepeat, 5);
  assert.equal(session.currentCombo, comboBeforeRepeat);
  assert.equal(session.phase, "won");
}
console.log("PASS RF-13/RF-14/RF-15: acierto repetido da 5 XP y no incrementa combo");

// Gherkin: equivocarse en una aparición repetida también cuesta una vida.
{
  const bank = makeQuestions();
  let session = continueAfterFeedback(answerWrong(newSession(bank), bank));
  while (session.currentQuestionIndex < session.initialQuestionCount) {
    session = answerCorrect(session, bank);
  }
  assert.ok(getCurrentSessionQuestion(session)?.isRepeat);
  const livesBefore = session.lives;
  session = answerWrong(session, bank);
  assert.equal(session.lives, livesBefore - 1);
  assert.equal(session.phase, "active");
  assert.equal(session.questionQueue[session.questionQueue.length - 1]?.isRepeat, true);
}
console.log("PASS RF-14: error en pregunta repetida resta otra vida y reencola si quedan vidas");

// Gherkin: victoria solo tras responder correctamente toda la cola con vida.
{
  const bank = makeQuestions();
  let session = newSession(bank);
  const plannedCount = session.initialQuestionCount;
  while (session.phase === "active") session = answerCorrect(session, bank);
  assert.equal(session.phase, "won");
  assert.ok(session.lives >= 1);
  assert.equal(session.correctAnswers, plannedCount);
  assert.equal(session.totalAttempts, plannedCount);
  const summary = getSessionSummary(session);
  assert.equal(summary.accuracyPercent, 100);
  assert.equal(summary.xpEarned, plannedCount * 10 + Math.max(0, plannedCount - 2) * 5);
  assert.equal(summary.bestCombo, plannedCount);
  assert.equal(summary.outcome, "won");
}
console.log("PASS RF-15: victoria y resumen incluyen precisión, XP y mejor combo");

// Gherkin: precisión aprobada redondea correctAnswers / totalAttempts * 100.
{
  const bank = makeQuestions();
  let won = newSession(bank);
  while (won.phase === "active") won = answerCorrect(won, bank);
  const summary = getSessionSummary({ ...won, correctAnswers: 8, totalAttempts: 10 });
  assert.equal(summary.accuracyPercent, Math.round((8 / 10) * 100));
  assert.equal(summary.accuracyPercent, 80);
}
console.log("PASS RF-15: precisión redondeada = Math.round((correctAnswers / totalAttempts) * 100)");

// Gherkin: el quinto error termina inmediatamente en cero vidas.
{
  const bank = makeQuestions();
  let session = newSession(bank);
  let errors = 0;
  while (session.phase === "active") {
    session = answerWrong(session, bank);
    errors += 1;
    if (session.phase === "active") session = continueAfterFeedback(session);
    assert.ok(errors <= 5, "la partida debe acabar en el quinto error");
  }
  assert.equal(errors, 5);
  assert.equal(session.phase, "out_of_lives");
  assert.equal(session.lives, 0);
  assert.ok(session.failedQuestionIds.length > 0);
  assert.equal(getCurrentSessionQuestion(session), null);
  assert.equal(getSessionSummary(session).outcome, "out_of_lives");
}
console.log("PASS RF-15: quinto error termina de inmediato con cero vidas y lista fallos");

// Gherkin: una partida nueva empieza en cinco vidas sin acumular el estado anterior.
{
  const bank = makeQuestions();
  const prior = newSession(bank);
  const lost = { ...prior, phase: "out_of_lives" as const, lives: 0 };
  const next = createGameSession({ unitId: 1, questions: bank, seed: 45 });
  assert.equal(lost.lives, 0);
  assert.equal(next.lives, 5);
}
console.log("PASS RN-02/RF-14: nueva sesión reinicia a cinco vidas, no hereda vidas");

console.log("RESULTADO: todos los escenarios automatizados de Spec 05 pasaron.");
