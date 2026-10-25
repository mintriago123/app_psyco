"use client";

import Link from "next/link";
import { useState } from "react";
import questionBankData from "../../../data/questions_bank.json";
import type { Question } from "../../../types/spec";
import { useAppState } from "../../components/AppProviders";
import { Icon } from "../../components/Icon";
import { removeFromErrorVault } from "../../lib/supabase/progress.service";

const questionBank = questionBankData as Question[];
const questionsById = new Map(questionBank.map((question) => [question.id, question]));

interface ReviewFeedback {
  outcome: "correct" | "incorrect";
  selectedOptionId: string;
}

export default function ErrorVaultPage() {
  const { user, progress, loading, error, refreshProgress } = useAppState();
  const [reviewQueue, setReviewQueue] = useState<Question[] | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);
  const [solvedCount, setSolvedCount] = useState(0);
  const [reviewComplete, setReviewComplete] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="page-wrap retention-page">
        <div className="status-panel"><p>Inicia sesión para abrir tu Baúl de Errores.</p><Link className="button button-primary" href="/login">Iniciar sesión</Link></div>
      </div>
    );
  }

  if (loading && !progress) {
    return <div className="page-wrap retention-page"><div className="status-panel" role="status"><p>Cargando tus preguntas pendientes…</p></div></div>;
  }

  if (error && !progress) {
    return (
      <div className="page-wrap retention-page">
        <div className="status-panel"><p role="alert">No se pudo cargar el Baúl: {error.message}</p><button className="button button-quiet" type="button" onClick={() => void refreshProgress()}>Reintentar</button></div>
      </div>
    );
  }

  if (!progress) {
    return <div className="page-wrap retention-page"><div className="status-panel"><p>No se encontró el progreso de esta cuenta.</p><Link className="button button-quiet" href="/">Volver al mapa</Link></div></div>;
  }

  const userId = user.id;
  const pendingIds = [...new Set(progress.error_chest_question_ids)];
  const pendingQuestions = pendingIds
    .map((questionId) => questionsById.get(questionId))
    .filter((question): question is Question => Boolean(question));
  const unresolvedCount = pendingIds.length - pendingQuestions.length;
  const currentQuestion = reviewQueue?.[questionIndex] ?? null;
  const correctOption = currentQuestion?.options.find((option) => option.id === currentQuestion.correctOptionId);

  function startReview() {
    const queue = pendingIds
      .map((questionId) => questionsById.get(questionId))
      .filter((question): question is Question => Boolean(question));
    setReviewQueue(queue);
    setQuestionIndex(0);
    setFeedback(null);
    setSolvedCount(0);
    setReviewComplete(queue.length === 0);
    setActionError(null);
  }

  async function answerQuestion(optionId: string) {
    if (!currentQuestion || feedback || removing) return;
    setActionError(null);
    if (optionId !== currentQuestion.correctOptionId) {
      setFeedback({ outcome: "incorrect", selectedOptionId: optionId });
      return;
    }

    setRemoving(true);
    try {
      const result = await removeFromErrorVault(userId, currentQuestion.id);
      if (result.error) {
        setActionError(`No se pudo retirar la pregunta del Baúl: ${result.error.message}`);
        return;
      }
      setSolvedCount((count) => count + 1);
      setFeedback({ outcome: "correct", selectedOptionId: optionId });
      void refreshProgress();
    } catch (removeError) {
      setActionError(removeError instanceof Error ? removeError.message : "No se pudo sincronizar la respuesta.");
    } finally {
      setRemoving(false);
    }
  }

  async function continueReview() {
    if (!reviewQueue) return;
    setFeedback(null);
    if (questionIndex + 1 >= reviewQueue.length) {
      await refreshProgress();
      setReviewComplete(true);
      return;
    }
    setQuestionIndex((index) => index + 1);
  }

  function resetReview() {
    setReviewQueue(null);
    setReviewComplete(false);
    setFeedback(null);
  }

  if (reviewComplete) {
    const remainingCount = progress.error_chest_question_ids.length;
    return (
      <div className="page-wrap retention-page">
        <section className="retention-hero">
          <span className="eyebrow"><Icon name="check" size={15} /> REPASO COMPLETADO</span>
          <h1>Un paso más cerca de una mirada clínica precisa.</h1>
          <p>Las respuestas correctas salieron del Baúl. Las preguntas que aún necesitan práctica siguen guardadas.</p>
        </section>
        <section className="review-summary glass-card" aria-label="Resumen del repaso">
          <article><span>Preguntas superadas</span><strong>{solvedCount}</strong></article>
          <article><span>Preguntas pendientes</span><strong>{remainingCount}</strong></article>
        </section>
        {error && <p className="form-message form-message-error" role="status">No se pudo actualizar el contador: {error.message}</p>}
        <div className="retention-actions">
          {remainingCount > 0 && <button className="button button-primary" type="button" onClick={resetReview}>Repasar pendientes</button>}
          <Link className="button button-quiet" href="/">Volver al mapa</Link>
        </div>
      </div>
    );
  }

  if (!reviewQueue) {
    if (pendingIds.length === 0) {
      return (
        <div className="page-wrap retention-page">
          <section className="empty-vault glass-card">
            <span className="empty-vault-icon"><Icon name="book" size={25} /></span>
            <span className="eyebrow">BAÚL DE ERRORES · AL DÍA</span>
            <h1>¡Excelente! No tienes fallos pendientes en tu baúl.</h1>
            <p>Tu práctica está despejada. Sigue avanzando por la ruta de estudio.</p>
            <Link className="button button-primary" href="/">Volver al mapa <Icon name="arrow" size={16} /></Link>
          </section>
        </div>
      );
    }

    return (
      <div className="page-wrap retention-page">
        <section className="retention-hero">
          <span className="eyebrow"><Icon name="book" size={15} /> REPASO CLÍNICO</span>
          <h1>Vuelve sobre los conceptos que necesitan otra mirada.</h1>
          <p>Este repaso es pedagógico: no consume vidas, no otorga XP ni modifica combos. Si aciertas, la pregunta se retira del Baúl; si fallas, permanece para otra sesión.</p>
        </section>
        <section className="vault-overview glass-card">
          <div className="vault-overview-icon"><Icon name="target" size={22} /></div>
          <div><span>Preguntas guardadas</span><strong>{pendingIds.length}</strong></div>
          <div><span>Listas para repasar</span><strong>{pendingQuestions.length}</strong></div>
        </section>
        {unresolvedCount > 0 && <p className="form-message form-message-error" role="status">{unresolvedCount} ID(s) del Baúl no coinciden con una pregunta del banco local.</p>}
        <div className="retention-actions">
          <button className="button button-primary" type="button" onClick={startReview} disabled={pendingQuestions.length === 0}>Iniciar repaso <Icon name="arrow" size={16} /></button>
          <Link className="button button-quiet" href="/">Volver al mapa</Link>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="page-wrap retention-page">
        <div className="status-panel"><p>El repaso terminó o no hay una pregunta disponible.</p><button className="button button-quiet" onClick={resetReview} type="button">Volver al Baúl</button></div>
      </div>
    );
  }

  const selectedOption = currentQuestion.options.find((option) => option.id === feedback?.selectedOptionId);
  const correctSelection = feedback?.outcome === "incorrect" ? correctOption : null;

  return (
    <div className="page-wrap retention-page">
      <section className="review-header">
        <div>
          <span className="eyebrow"><Icon name="book" size={15} /> REPASO SIN VIDAS NI XP</span>
          <h1>Baúl de Errores</h1>
        </div>
        <Link className="button button-quiet review-exit" href="/">Salir al mapa</Link>
      </section>
      <div className="review-progress-head"><span>Pregunta {questionIndex + 1} de {reviewQueue.length}</span><span>{solvedCount} superadas</span></div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={reviewQueue.length} aria-valuenow={questionIndex + 1}>
        <div className="progress-fill" style={{ width: `${((questionIndex + 1) / reviewQueue.length) * 100}%` }} />
      </div>
      <article className="review-question glass-card">
        <div className="question-meta"><span className="question-type">{currentQuestion.format === "clinical_case" ? "CASO CLÍNICO" : currentQuestion.format === "true_false" ? "VERDADERO O FALSO" : "SELECCIÓN MÚLTIPLE"}</span><span className="question-number">UNIDAD {String(currentQuestion.unitId).padStart(2, "0")}</span></div>
        <h2>{currentQuestion.prompt}</h2>
        <div className="answer-list" role="group" aria-label="Opciones de repaso">
          {currentQuestion.options.map((option, index) => {
            const isCorrect = feedback?.outcome === "incorrect" && option.id === currentQuestion.correctOptionId;
            const isWrong = feedback?.outcome === "incorrect" && option.id === feedback.selectedOptionId;
            const isChosenCorrect = feedback?.outcome === "correct" && option.id === feedback.selectedOptionId;
            return (
              <button
                aria-pressed={feedback?.selectedOptionId === option.id}
                className={`answer-option ${isCorrect || isChosenCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`}
                disabled={Boolean(feedback) || removing}
                key={option.id}
                onClick={() => void answerQuestion(option.id)}
                type="button"
              >
                <span className="option-key">{String.fromCharCode(65 + index)}</span><span className="answer-text">{option.text}</span>
                {isCorrect && <Icon className="answer-indicator" name="check" size={18} />}
                {isWrong && <Icon className="answer-indicator" name="close" size={18} />}
              </button>
            );
          })}
        </div>
        {removing && <p className="form-message" role="status">Retirando la pregunta del Baúl…</p>}
        {actionError && <p className="form-message form-message-error" role="alert">{actionError}</p>}
      </article>
      {feedback && (
        <aside className={`review-feedback ${feedback.outcome === "correct" ? "is-correct-feedback" : ""}`} aria-live="polite">
          <strong><Icon name={feedback.outcome === "correct" ? "check" : "close"} size={16} />{feedback.outcome === "correct" ? "Concepto reforzado" : "Revisa el concepto"}</strong>
          {feedback.outcome === "correct" ? (
            <p>La pregunta se retiró del Baúl. El repaso no suma XP ni modifica vidas o combos.</p>
          ) : (
            <>
              <p>Elegiste: <b>{selectedOption?.text}</b>. La respuesta correcta es: <b>{correctSelection?.text}</b>.</p>
              <p>{currentQuestion.explanation}</p>
              <span>Guía oficial · página {currentQuestion.sourcePage}. La pregunta permanece en tu Baúl.</span>
            </>
          )}
          <button className="button button-primary" type="button" onClick={() => void continueReview()}>
            {questionIndex + 1 === reviewQueue.length ? "Ver resumen" : "Siguiente pregunta"}<Icon name="arrow" size={16} />
          </button>
        </aside>
      )}
    </div>
  );
}
