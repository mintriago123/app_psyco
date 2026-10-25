"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import questionBankData from "../../../../../data/questions_bank.json";
import type { GameSessionState, Question, UnitId } from "../../../../../types/spec";
import { useGameExitGuard } from "../../../../hooks/useGameExitGuard";
import { addToErrorVault, upsertProgress } from "../../../../lib/supabase/progress.service";
import {
  continueAfterFeedback,
  createGameSession,
  getCurrentSessionQuestion,
  getHintSegments,
  getProgressPercent,
  revealHint,
  submitAnswer,
} from "../../../../../lib/game-engine";
import { STUDY_UNITS } from "../../../../lib/unit-catalog";
import { storeGameResult } from "../../../../lib/game-session-storage";
import { useAppState } from "../../../../components/AppProviders";
import { Icon } from "../../../../components/Icon";

const questionBank = questionBankData as Question[];

function parseUnitId(value: string): UnitId | null {
  const numericId = Number(value);
  return STUDY_UNITS.some((unit) => unit.id === numericId) ? (numericId as UnitId) : null;
}

function makeSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

function formatQuestionType(format: Question["format"]): string {
  if (format === "clinical_case") return "CASO CLÍNICO";
  if (format === "true_false") return "VERDADERO O FALSO";
  return "SELECCIÓN MÚLTIPLE";
}

function PlayExperience({ unitParam }: { unitParam: string }) {
  const router = useRouter();
  const {
    user,
    loading: sessionLoading,
    progress,
    loading: progressLoading,
    error: progressError,
    refreshProgress,
  } = useAppState();
  const unitId = parseUnitId(unitParam);
  const [gameSession, setGameSession] = useState<GameSessionState | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const initializationKey = useRef<string | null>(null);
  const toastTimeout = useRef<number | null>(null);

  useGameExitGuard({ userId: user?.id ?? null, session: gameSession });

  useEffect(() => {
    if (sessionLoading || progressLoading || !user || !unitId || !progress) return;
    const key = `${user.id}:${unitId}`;
    if (initializationKey.current === key) return;
    initializationKey.current = key;

    if (!progress.unlocked_unit_ids.includes(unitId)) {
      router.replace("/");
      return;
    }

    const savedSession = progress.active_game_session;
    if (savedSession?.phase === "active" && savedSession.unitId !== unitId) {
      setInitError(
        `Tienes una partida activa en la Unidad ${savedSession.unitId}. Retómala antes de iniciar otra.`,
      );
      setReady(true);
      return;
    }

    if (savedSession?.phase === "active" && savedSession.unitId === unitId) {
      setGameSession(savedSession);
      setReady(true);
      return;
    }

    try {
      const nextSession = createGameSession({
        unitId,
        questions: questionBank,
        seed: makeSeed(),
      });
      setGameSession(nextSession);
      setReady(true);
      void upsertProgress(user.id, {
        active_game_session: nextSession,
        statistics: {
          ...progress.statistics,
          gamesStarted: progress.statistics.gamesStarted + 1,
        },
      }).then(({ error }) => {
        if (error) setSaveWarning("La partida inició, pero el guardado en la nube no se confirmó.");
      });
    } catch (error) {
      setInitError(error instanceof Error ? error.message : "No se pudo iniciar la partida.");
      setReady(true);
    }
  }, [progress, progressLoading, router, sessionLoading, unitId, user]);

  useEffect(() => () => {
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current);
  }, []);

  const unit = useMemo(
    () => (unitId ? STUDY_UNITS.find((item) => item.id === unitId) ?? null : null),
    [unitId],
  );
  const currentInstance = gameSession
    ? getCurrentSessionQuestion(gameSession)
    : null;
  const currentQuestion = currentInstance
    ? questionBank.find((question) => question.id === currentInstance.questionId) ?? null
    : null;
  const progressPercent = gameSession ? getProgressPercent(gameSession) : 0;

  function finishSession(session: GameSessionState) {
    storeGameResult(session);
    router.replace(`/unit/${session.unitId}/result`);
  }

  function handleAnswer(optionId: string) {
    if (!gameSession || !currentQuestion || gameSession.feedback || gameSession.phase !== "active") return;

    const nextSession = submitAnswer(gameSession, currentQuestion, optionId);
    setGameSession(nextSession);

    if (nextSession.feedback?.outcome === "incorrect") {
      void addToErrorVault(user!.id, currentQuestion.id).then(({ error }) => {
        if (error) setSaveWarning("Un error todavía no se sincroniza con el Baúl; se intentará guardar al cerrar la partida.");
      });
      if (nextSession.phase === "out_of_lives") finishSession(nextSession);
      return;
    }

    if (nextSession.phase === "won") {
      finishSession(nextSession);
      return;
    }

    const earnedNow = nextSession.earnedXp - gameSession.earnedXp;
    setXpToast(earnedNow);
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current);
    toastTimeout.current = window.setTimeout(() => setXpToast(null), 1050);
  }

  function handleHint() {
    if (!gameSession || !currentQuestion || !currentInstance || currentInstance.hintUsed) return;
    setGameSession(revealHint(gameSession, currentQuestion));
  }

  function handleContinue() {
    if (!gameSession || gameSession.phase !== "active" || !gameSession.feedback) return;
    setGameSession(continueAfterFeedback(gameSession));
  }

  if (sessionLoading || progressLoading || !ready) {
    return <div className="page-wrap"><div className="status-panel" role="status"><p>Preparando la partida y sincronizando tu progreso…</p></div></div>;
  }

  if (!user) {
    return <div className="page-wrap"><div className="status-panel"><p>Inicia sesión para continuar.</p><Link className="button button-primary" href="/login">Iniciar sesión</Link></div></div>;
  }

  if (progressError) {
    return <div className="page-wrap"><div className="status-panel"><p role="alert">No se pudo leer el progreso: {progressError.message}</p><button className="button button-quiet" onClick={() => void refreshProgress()} type="button">Reintentar</button></div></div>;
  }

  if (!unitId || !unit) {
    return <div className="page-wrap"><div className="status-panel"><p>La unidad solicitada no existe.</p><Link className="button button-quiet" href="/">Volver al mapa</Link></div></div>;
  }

  if (initError) {
    const savedUnitId = progress?.active_game_session?.unitId;
    return (
      <div className="page-wrap">
        <div className="status-panel">
          <p>{initError}</p>
          {savedUnitId && <Link className="button button-primary" href={`/unit/${savedUnitId}/play`}>Retomar Unidad {savedUnitId}</Link>}
          <Link className="button button-quiet" href="/">Volver al mapa</Link>
        </div>
      </div>
    );
  }

  if (!gameSession || !currentInstance || !currentQuestion) {
    return <div className="page-wrap"><div className="status-panel"><p>No se pudo recuperar la pregunta actual.</p><Link className="button button-quiet" href="/">Volver al mapa</Link></div></div>;
  }

  const orderedOptions = currentInstance.optionOrder
    .map((optionId) => currentQuestion.options.find((option) => option.id === optionId))
    .filter((option): option is (typeof currentQuestion.options)[number] => Boolean(option));
  const visibleOptions = orderedOptions.length ? orderedOptions : currentQuestion.options;
  const hintSegments = currentInstance.hintUsed
    ? getHintSegments(currentQuestion)
    : [{ text: currentQuestion.prompt, highlighted: false }];
  const feedback = gameSession.feedback;
  const correctOption = feedback
    ? currentQuestion.options.find((option) => option.id === feedback.correctOptionId)
    : null;
  const currentQuestionNumber = Math.min(gameSession.currentQuestionIndex + 1, gameSession.questionQueue.length);

  return (
    <div className="play-page">
      <header className="play-topbar">
        <div className="play-unit-label">
          <span>UNIDAD {String(unit.id).padStart(2, "0")}</span>
          <strong>{unit.title}</strong>
        </div>
        <div className="play-stats">
          <div className="life-counter" aria-label={`${gameSession.lives} de 5 vidas disponibles`}>
            <span className="life-icons" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <Icon
                  className={index < gameSession.lives ? "" : "life-empty"}
                  fill={index < gameSession.lives ? "currentColor" : "none"}
                  key={index}
                  name="heart"
                  size={15}
                />
              ))}
            </span>
            <span>{gameSession.lives}/5</span>
          </div>
          <div className={`combo-chip ${gameSession.currentCombo >= 3 ? "is-combo" : ""}`}>
            <Icon name="bolt" size={15} /> Racha {gameSession.currentCombo}
          </div>
          {currentInstance.isRepeat && <div className="repeat-chip">Pregunta repetida</div>}
        </div>
      </header>

      <div className="question-progress" aria-label={`Progreso ${progressPercent}%`}>
        <div className="question-progress-head">
          <span>Progreso de la lección</span>
          <span>{progressPercent}% · {gameSession.completedQuestionIds.length}/{gameSession.initialQuestionCount}</span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <main className="question-panel">
        <div className="question-meta">
          <span className="question-type">{formatQuestionType(currentQuestion.format)}</span>
          <span className="question-number">RETO {String(currentQuestionNumber).padStart(2, "0")}</span>
        </div>
        <h1 className="question-prompt">
          {hintSegments.map((segment, index) => segment.highlighted
            ? <mark className="hint-mark" key={`${segment.text}-${index}`}>{segment.text}</mark>
            : <span key={`${segment.text}-${index}`}>{segment.text}</span>)}
        </h1>

        {currentQuestion.format === "clinical_case" && !currentInstance.hintUsed && !feedback && (
          <button className="hint-action" type="button" onClick={handleHint}>
            <Icon name="spark" size={16} /> Pedir pista
          </button>
        )}
        {currentQuestion.format === "clinical_case" && currentInstance.hintUsed && !feedback && (
          <p className="hint-action" aria-live="polite"><Icon name="check" size={15} /> Pista utilizada · este acierto vale 5 XP</p>
        )}

        <div className="answer-list" role="group" aria-label="Opciones de respuesta">
          {visibleOptions.map((option, index) => {
            const isCorrect = feedback?.outcome === "incorrect" && option.id === feedback.correctOptionId;
            const isWrong = feedback?.outcome === "incorrect" && option.id === feedback.selectedOptionId;
            return (
              <button
                aria-pressed={feedback?.selectedOptionId === option.id}
                className={`answer-option ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`}
                disabled={Boolean(feedback) || gameSession.phase !== "active"}
                key={option.id}
                onClick={() => handleAnswer(option.id)}
                type="button"
              >
                <span className="option-key">{String.fromCharCode(65 + index)}</span>
                <span className="answer-text">{option.text}</span>
                {isCorrect && <Icon className="answer-indicator" name="check" size={18} />}
                {isWrong && <Icon className="answer-indicator" name="close" size={18} />}
              </button>
            );
          })}
        </div>
        {saveWarning && <p className="form-message form-message-error play-error" role="status">{saveWarning}</p>}
      </main>

      {xpToast !== null && (
        <div className="answer-toast" role="status"><Icon name="spark" size={16} /> +{xpToast} XP</div>
      )}

      {feedback && feedback.outcome === "incorrect" && gameSession.phase === "active" && (
        <aside className="feedback-dock" aria-live="polite" aria-label="Explicación de la respuesta">
          <div className="feedback-head">
            <div>
              <strong><Icon name="close" size={16} /> Respuesta incorrecta</strong>
              <p>La respuesta correcta es: <b>{correctOption?.text}</b></p>
            </div>
            <span className="repeat-chip">−1 vida</span>
          </div>
          <p className="feedback-explanation">{feedback.explanation}</p>
          <p className="feedback-source"><strong>Guía oficial · página {feedback.sourcePage}</strong></p>
          <div className="feedback-actions">
            <button className="button button-primary" type="button" onClick={handleContinue}>
              Entendido / Continuar <Icon name="arrow" size={16} />
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function PlayPageClient({ unitParam }: { unitParam: string }) {
  return <PlayExperience unitParam={unitParam} />;
}
