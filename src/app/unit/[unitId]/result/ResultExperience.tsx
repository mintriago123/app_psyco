"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GameSessionState, Question, UnitId } from "../../../../../types/spec";
import questionBankData from "../../../../../data/questions_bank.json";
import { useAppState } from "../../../../components/AppProviders";
import { Icon } from "../../../../components/Icon";
import {
  getProgressPercent,
  getSessionSummary,
} from "../../../../../lib/game-engine";
import {
  getResultPersistenceKey,
  readGameResult,
} from "../../../../lib/game-session-storage";
import { persistFinishedSession } from "../../../../lib/game-results";
import { STUDY_UNITS } from "../../../../lib/unit-catalog";

const questionBank = questionBankData as Question[];

function parseUnitId(value: string): UnitId | null {
  const numericId = Number(value);
  return STUDY_UNITS.some((unit) => unit.id === numericId) ? (numericId as UnitId) : null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ResultExperience({ unitParam }: { unitParam: string }) {
  const { user, loading: sessionLoading, refreshProgress } = useAppState();
  const unitId = parseUnitId(unitParam);
  const [session, setSession] = useState<GameSessionState | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const activeSaveKey = useRef<string | null>(null);

  useEffect(() => {
    if (!unitId) {
      setSessionLoaded(true);
      return;
    }
    setSession(readGameResult(unitId));
    setSessionLoaded(true);
  }, [unitId]);

  const unit = useMemo(
    () => (unitId ? STUDY_UNITS.find((item) => item.id === unitId) ?? null : null),
    [unitId],
  );

  useEffect(() => {
    if (!sessionLoaded || !session || !user || sessionLoading) return;
    const saveKey = getResultPersistenceKey(session);
    if (window.sessionStorage.getItem(saveKey) === "done") {
      setSaveState("saved");
      return;
    }
    if (activeSaveKey.current === saveKey) return;

    activeSaveKey.current = saveKey;
    setSaveState("saving");
    setSaveError(null);

    void persistFinishedSession(user.id, session).then(({ error }) => {
      if (error) {
        activeSaveKey.current = null;
        setSaveState("error");
        setSaveError(error.message || "No se pudo sincronizar el resultado.");
        return;
      }
      window.sessionStorage.setItem(saveKey, "done");
      setSaveState("saved");
      void refreshProgress();
    }).catch((error: unknown) => {
      activeSaveKey.current = null;
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudo sincronizar el resultado.");
    });
  }, [refreshProgress, retryCount, session, sessionLoaded, sessionLoading, user]);

  if (sessionLoading || !sessionLoaded) {
    return <div className="result-shell"><div className="status-panel" role="status"><p>Preparando el resumen de la partida…</p></div></div>;
  }

  if (!user) {
    return <div className="result-shell"><div className="status-panel"><p>Inicia sesión para recuperar el resultado guardado.</p><Link className="button button-primary" href="/login">Iniciar sesión</Link></div></div>;
  }

  if (!unitId || !unit || !session) {
    return <div className="result-shell"><div className="status-panel"><p>No se encontró un resultado para esta unidad en esta pestaña.</p><Link className="button button-quiet" href="/">Volver al mapa</Link></div></div>;
  }

  const summary = getSessionSummary(session);
  const failedQuestions = summary.failedQuestionIds
    .map((questionId) => questionBank.find((question) => question.id === questionId))
    .filter((question): question is Question => Boolean(question));
  const isWin = summary.outcome === "won";

  return (
    <div className="result-shell">
      <article className="result-card glass-card">
        <header className={`result-banner ${isWin ? "" : "is-loss"}`}>
          <span className="result-emblem">
            <Icon name={isWin ? "mark" : "heart"} size={27} />
          </span>
          <span className="eyebrow">UNIDAD {String(unit.id).padStart(2, "0")} · {unit.title}</span>
          <h1>{isWin ? "Lección completada." : "La práctica termina aquí."}</h1>
          <p>
            {isWin
              ? "Terminaste todos los retos de la sesión conservando al menos una vida. Tu avance ya forma parte de tu ruta."
              : "Llegaste a cero vidas. Revisa las preguntas y sus explicaciones; podrás iniciar otra partida con cinco vidas."}
          </p>
        </header>

        <section className="result-metrics" aria-label="Resumen de partida">
          <div className="result-metric"><span>Precisión</span><strong>{summary.accuracyPercent}<small>%</small></strong></div>
          <div className="result-metric"><span>XP de la partida</span><strong>{summary.xpEarned}<small>XP</small></strong></div>
          <div className="result-metric"><span>Mejor combo</span><strong>{summary.bestCombo}<small>aciertos</small></strong></div>
        </section>

        {!isWin && (
          <section className="result-content">
            <h2>Preguntas para repasar · {failedQuestions.length}</h2>
            {failedQuestions.length > 0 ? (
              <div className="failed-list">
                {failedQuestions.map((question) => {
                  const correctAnswer = question.options.find((option) => option.id === question.correctOptionId);
                  return (
                    <article className="failed-question" key={question.id}>
                      <h3>{question.prompt}</h3>
                      <p><strong>Respuesta correcta:</strong> {correctAnswer?.text}</p>
                      <p>{question.explanation}</p>
                      <p className="failed-source">Guía oficial · página {question.sourcePage}</p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="dashboard-footnote">No quedaron preguntas falladas para repasar.</p>
            )}
          </section>
        )}

        <div className="save-status">
          {saveState === "saving" && <p className="form-message" role="status">Sincronizando resultado, XP y preguntas falladas…</p>}
          {saveState === "saved" && <p className="form-message form-message-success" role="status">Resultado y progreso sincronizados.</p>}
          {saveState === "error" && (
            <div className="form-message form-message-error" role="alert">
              <p>{saveError}</p>
              <button className="button button-quiet" type="button" onClick={() => setRetryCount((count) => count + 1)}>
                Reintentar sincronización
              </button>
            </div>
          )}
        </div>

        <footer className="result-actions">
          {!isWin && (
            <Link className="button button-primary" href={`/unit/${unit.id}/play`}>
              Nueva partida <Icon name="arrow" size={16} />
            </Link>
          )}
          <Link className="button button-quiet" href="/">Volver al mapa</Link>
        </footer>
      </article>
      <span className="sr-only">Progreso de la partida: {getProgressPercent(session)}%</span>
    </div>
  );
}
