"use client";

import Link from "next/link";
import { useState } from "react";
import type { MasteryLevel, MedalId } from "../../../types/spec";
import { useAppState } from "../../components/AppProviders";
import { Icon } from "../../components/Icon";
import { signOut } from "../../lib/supabase/auth.service";
import { STUDY_MODULES, STUDY_UNITS } from "../../lib/unit-catalog";
import { useRouter } from "next/navigation";

const MEDALS: Array<{ id: MedalId; symbol: string; title: string; description: string }> = [
  {
    id: "ojo-clinico",
    symbol: "👁️",
    title: "Ojo Clínico",
    description: "Completa una lección con 100% de precisión y 0 errores.",
  },
  {
    id: "semiologo-experto",
    symbol: "🧠",
    title: "Semiólogo Experto",
    description: "Alcanza nivel Oro (3 maestrías) en todas las unidades del Módulo 1 (Semiología).",
  },
  {
    id: "combo-imparable",
    symbol: "🔥",
    title: "Combo Imparable",
    description: "Alcanza una racha de 5 o más aciertos consecutivos en una partida.",
  },
];

function masteryLabel(mastery: MasteryLevel): string {
  if (mastery === "bronze") return "Bronce";
  if (mastery === "silver") return "Plata";
  if (mastery === "gold") return "Oro";
  return "Ninguno";
}

function masteryClass(mastery: MasteryLevel): string {
  if (mastery === "bronze") return "mastery-bronze";
  if (mastery === "silver") return "mastery-silver";
  if (mastery === "gold") return "mastery-gold";
  return "mastery-none";
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, progress, loading, error, refreshProgress, setSession } = useAppState();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function reloadProgress() {
    setRefreshing(true);
    await refreshProgress();
    setRefreshing(false);
  }

  async function confirmLogout() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const result = await signOut();
      if (result.error) {
        setSignOutError(result.error.message || "No se pudo cerrar la sesión.");
        return;
      }
      setSession(null);
      router.replace("/login");
      router.refresh();
    } catch (logoutError) {
      setSignOutError(logoutError instanceof Error ? logoutError.message : "No se pudo cerrar la sesión.");
    } finally {
      setSigningOut(false);
    }
  }

  if (!user) {
    return <div className="page-wrap retention-page"><div className="status-panel"><p>Inicia sesión para consultar tu perfil.</p><Link className="button button-primary" href="/login">Iniciar sesión</Link></div></div>;
  }

  if (loading && !progress) {
    return <div className="page-wrap retention-page"><div className="status-panel" role="status"><p>Cargando tus estadísticas…</p></div></div>;
  }

  if (error && !progress) {
    return <div className="page-wrap retention-page"><div className="status-panel"><p role="alert">No se pudo cargar tu perfil: {error.message}</p><button className="button button-quiet" type="button" onClick={() => void reloadProgress()}>Reintentar</button></div></div>;
  }

  if (!progress) {
    return <div className="page-wrap retention-page"><div className="status-panel"><p>No se encontró el progreso de esta cuenta.</p><Link className="button button-quiet" href="/">Volver al mapa</Link></div></div>;
  }

  const statistics = progress.statistics;
  const globalAccuracy = statistics.questionsAnswered > 0
    ? Math.round((statistics.correctAnswers / statistics.questionsAnswered) * 100)
    : 0;
  const lessonsCompleted = STUDY_UNITS.reduce(
    (total, unit) => total + (progress.unit_progress[unit.id]?.completionCount ?? 0),
    0,
  );
  const unlockedMedals = new Set(progress.unlocked_medals);

  return (
    <div className="page-wrap retention-page profile-page">
      <section className="retention-hero profile-hero">
        <span className="eyebrow"><Icon name="mark" size={15} /> PERFIL DE ESTUDIANTE</span>
        <h1>Tu recorrido de aprendizaje.</h1>
        <p>{user.email} · Tus estadísticas, maestrías y medallas en Psicopatología I.</p>
      </section>

      <section className="profile-stats" aria-label="Estadísticas de avance">
        <article className="profile-stat glass-card"><span><Icon name="spark" size={15} /> XP total</span><strong>{progress.total_xp.toLocaleString("es-EC")}</strong><small>Puntos acumulados</small></article>
        <article className="profile-stat glass-card"><span><Icon name="check" size={15} /> Partidas ganadas</span><strong>{statistics.gamesWon}</strong><small>{lessonsCompleted} lecciones completadas</small></article>
        <article className="profile-stat glass-card"><span><Icon name="book" size={15} /> Preguntas respondidas</span><strong>{statistics.questionsAnswered.toLocaleString("es-EC")}</strong><small>En todas tus partidas</small></article>
        <article className="profile-stat glass-card"><span><Icon name="target" size={15} /> Precisión global</span><strong>{globalAccuracy}<small>%</small></strong><small>{statistics.correctAnswers} aciertos</small></article>
        <article className="profile-stat glass-card"><span><Icon name="bolt" size={15} /> Mejor combo</span><strong>{statistics.bestCombo}</strong><small>Aciertos consecutivos</small></article>
      </section>

      <section className="profile-section" aria-labelledby="medals-title">
        <div className="retention-section-heading">
          <div><span className="eyebrow">COLECCIÓN</span><h2 id="medals-title">Vitrina de medallas</h2></div>
          <span className="section-count">{unlockedMedals.size} DE 3 DESBLOQUEADAS</span>
        </div>
        <div className="medals-grid">
          {MEDALS.map((medal) => {
            const unlocked = unlockedMedals.has(medal.id);
            return (
              <article className={`medal-card glass-card ${unlocked ? "is-unlocked" : "is-locked"}`} key={medal.id}>
                <div className="medal-card-top">
                  <span className="medal-symbol" aria-hidden="true">{medal.symbol}</span>
                  {unlocked ? (
                    <span className="medal-status unlocked"><Icon name="check" size={12} /> Desbloqueada</span>
                  ) : (
                    <span className="medal-status locked"><Icon name="lock" size={12} /> Pendiente</span>
                  )}
                </div>
                <h3>{medal.title}</h3>
                <p>{medal.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="mastery-title">
        <div className="retention-section-heading">
          <div><span className="eyebrow">RUTA DE ESTUDIO</span><h2 id="mastery-title">Maestría por unidad</h2></div>
          <Link className="profile-inline-link" href="/">Ver mapa <Icon name="arrow" size={14} /></Link>
        </div>
        <div className="mastery-list">
          {STUDY_UNITS.map((unit) => {
            const unitProgress = progress.unit_progress[unit.id];
            const mastery = unitProgress?.mastery ?? "none";
            const moduleTitle = STUDY_MODULES.find((module) => module.id === unit.moduleId)?.id === 1 ? "Semiología" : "Síndromes";
            return (
              <article className="mastery-row" key={unit.id}>
                <div className="mastery-unit-number">{String(unit.id).padStart(2, "0")}</div>
                <div className="mastery-unit-info"><strong>{unit.title}</strong><span>{moduleTitle} · {unitProgress?.completionCount ?? 0} {(unitProgress?.completionCount ?? 0) === 1 ? "finalización" : "finalizaciones"}</span></div>
                <span className={`mastery-badge ${masteryClass(mastery)}`}>{masteryLabel(mastery)}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="profile-account glass-card" aria-labelledby="account-title">
        <div><span className="eyebrow">CUENTA PERSONAL</span><h2 id="account-title">Sesión de estudiante</h2><p>Tu progreso se sincroniza con esta cuenta.</p></div>
        <button className="button button-quiet" type="button" onClick={() => { setSignOutError(null); setConfirmSignOut(true); }}>
          Cerrar sesión <Icon name="arrow" size={16} />
        </button>
      </section>
      {error && <p className="form-message form-message-error profile-refresh-error" role="status">No se pudo actualizar el perfil: {error.message}</p>}
      {refreshing && <p className="dashboard-footnote" role="status">Actualizando estadísticas…</p>}

      {confirmSignOut && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !signingOut) setConfirmSignOut(false); }}>
          <section className="confirmation-modal glass-card" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" aria-describedby="signout-description">
            <span className="confirmation-icon"><Icon name="mark" size={22} /></span>
            <h2 id="signout-title">¿Cerrar sesión?</h2>
            <p id="signout-description">Tu progreso guardado seguirá disponible cuando vuelvas a ingresar.</p>
            {signOutError && <p className="form-message form-message-error" role="alert">{signOutError}</p>}
            <div className="confirmation-actions">
              <button className="button button-quiet" type="button" onClick={() => setConfirmSignOut(false)} disabled={signingOut}>Cancelar</button>
              <button className="button button-primary" type="button" onClick={() => void confirmLogout()} disabled={signingOut}>
                {signingOut ? "Cerrando…" : "Sí, cerrar sesión"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
