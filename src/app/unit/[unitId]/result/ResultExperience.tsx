"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PersistedGameSession, Question, UnitId } from "../../../../../types/spec";
import questionBankData from "../../../../../data/questions_bank.json";
import { useAppState } from "../../../../components/AppProviders";
import { Icon } from "../../../../components/Icon";
import {
  getProgressPercent,
  getSessionSummary,
} from "../../../../../lib/game-engine";
import {
  getFinishedGame,
  readGameResult,
  storeGameResult,
} from "../../../../lib/game-session-storage";
import { getProgress, persistFinishedSession } from "../../../../lib/supabase/progress.service";
import { STUDY_UNITS } from "../../../../lib/unit-catalog";

const questionBank = questionBankData as Question[];

function parseUnitId(value: string): UnitId | null {
  const numericId = Number(value);
  return STUDY_UNITS.some((unit) => unit.id === numericId) ? (numericId as UnitId) : null;
}

type ResultState =
  | { status: "saved"; session: PersistedGameSession }
  | { status: "missing"; session: null }
  | { status: "error"; session: PersistedGameSession | null; message: string };

export default function ResultExperience({ unitParam }: { unitParam: string }) {
  const { user, loading } = useAppState();
  const unitId = parseUnitId(unitParam);

  if (loading && !user) {
    return <div className="result-shell"><div className="status-panel" role="status"><p>Preparando el resumen de la partida…</p></div></div>;
  }
  if (!user) {
    return <div className="result-shell"><div className="status-panel"><p>Inicia sesión para recuperar el resultado guardado.</p><Link className="button button-primary" href="/login">Iniciar sesión</Link></div></div>;
  }

  const unit = STUDY_UNITS.find((item) => item.id === unitId);
  if (!unit) {
    return <div className="result-shell"><div className="status-panel"><p>La unidad solicitada no existe.</p><Link className="button button-quiet" href="/">Volver al mapa</Link></div></div>;
  }

  return <GameResult key={`${user.id}:${unit.id}`} userId={user.id} unit={unit} />;
}

function GameResult({ userId, unit }: { userId: string; unit: (typeof STUDY_UNITS)[number] }) {
  const { refreshProgress } = useAppState();
  const [result, setResult] = useState<ResultState | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function syncResult() {
      const localResult = readGameResult(userId, unit.id);
      try {
        if (localResult) {
          const saved = await persistFinishedSession(userId, localResult);
          if (cancelled) return;
          storeGameResult(userId, saved);
          setResult({ status: "saved", session: saved });
          void refreshProgress();
          return;
        }

        const progress = await getProgress(userId);
        if (cancelled) return;
        const saved = getFinishedGame(progress?.active_game_session);
        setResult(saved?.unitId === unit.id
          ? { status: "saved", session: saved }
          : { status: "missing", session: null });
      } catch (error) {
        if (!cancelled) {
          setResult({
            status: "error",
            session: localResult,
            message: error instanceof Error ? error.message : "No se pudo sincronizar el resultado.",
          });
        }
      }
    }

    void syncResult();
    return () => { cancelled = true; };
  }, [refreshProgress, retryCount, unit.id, userId]);

  function retry() {
    setResult(null);
    setRetryCount((count) => count + 1);
  }

  if (!result) {
    return <div className="result-shell"><div className="status-panel" role="status"><p>Sincronizando resultado, XP y preguntas falladas…</p></div></div>;
  }
  if (!result.session) {
    return (
      <div className="result-shell">
        <div className="status-panel">
          {result.status === "error" ? (
            <>
              <p role="alert">{result.message}</p>
              <button className="button button-quiet" type="button" onClick={retry}>Reintentar sincronización</button>
            </>
          ) : (
            <p>No se encontró un resultado para esta unidad.</p>
          )}
          <Link className="button button-quiet" href="/">Volver al mapa</Link>
        </div>
      </div>
    );
  }

  const session = result.session;
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
              ? "Terminaste todos los retos de la sesión conservando al menos una vida."
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
          {result.status === "saved" && <p className="form-message form-message-success" role="status">Resultado y progreso sincronizados.</p>}
          {result.status === "error" && (
            <div className="form-message form-message-error" role="alert">
              <p>{result.message}</p>
              <button className="button button-quiet" type="button" onClick={retry}>
                Reintentar sincronización
              </button>
            </div>
          )}
        </div>

        <footer className="result-actions">
          {!isWin && result.status === "saved" && (
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
