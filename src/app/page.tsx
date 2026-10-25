"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import keyNotesData from "../../data/key_notes.json";
import type { KeyNotes, MasteryLevel, StudyUnit, UnitId } from "../../types/spec";
import { KeyNotesModal } from "../components/KeyNotesModal";
import { Icon } from "../components/Icon";
import { useAppState } from "../components/AppProviders";
import { STUDY_MODULES, STUDY_UNITS } from "../lib/unit-catalog";

const keyNotes = keyNotesData as KeyNotes[];

function masteryLabel(mastery: MasteryLevel): string | null {
  if (mastery === "bronze") return "Bronce · Nivel 1";
  if (mastery === "silver") return "Plata · Nivel 2";
  if (mastery === "gold") return "Oro · Nivel 3";
  return null;
}

function masteryClass(mastery: MasteryLevel): string {
  if (mastery === "bronze") return "mastery-bronze";
  if (mastery === "silver") return "mastery-silver";
  if (mastery === "gold") return "mastery-gold";
  return "";
}

export default function Home() {
  const router = useRouter();
  const {
    user,
    loading: sessionLoading,
    progress,
    loading: progressLoading,
    error: progressError,
    refreshProgress,
  } = useAppState();
  const [activeModuleId, setActiveModuleId] = useState<1 | 2>(1);
  const [selectedUnit, setSelectedUnit] = useState<StudyUnit | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const activeModule = STUDY_MODULES.find((module) => module.id === activeModuleId)!;
  const moduleUnits = useMemo(
    () => STUDY_UNITS.filter((unit) => unit.moduleId === activeModuleId),
    [activeModuleId],
  );
  const availableCount = progress
    ? progress.unlocked_unit_ids.filter((unitId) => activeModule.unitIds.includes(unitId)).length
    : 0;
  const masteredCount = progress
    ? activeModule.unitIds.filter((unitId) => progress.unit_progress[unitId]?.mastery === "gold").length
    : 0;
  const completedCount = progress
    ? activeModule.unitIds.filter((unitId) => progress.unit_progress[unitId]?.completionCount > 0).length
    : 0;

  const closeNotes = useCallback(() => setNotesOpen(false), []);
  const startSelectedUnit = useCallback(() => {
    if (!selectedUnit) return;
    setNotesOpen(false);
    router.push(`/unit/${selectedUnit.id}/play`);
  }, [router, selectedUnit]);

  function openUnit(unit: StudyUnit) {
    setSelectedUnit(unit);
    setNotesOpen(true);
  }

  const notes = selectedUnit
    ? keyNotes.find((item) => item.unitId === selectedUnit.id) ?? null
    : null;
  const activeSession = progress?.active_game_session;
  const resumableUnit =
    activeSession?.phase === "active"
      ? STUDY_UNITS.find((unit) => unit.id === activeSession.unitId)
      : null;
  const canResume = Boolean(user && resumableUnit);

  if (sessionLoading || (user && progressLoading)) {
    return (
      <div className="page-wrap">
        <div className="status-panel" role="status"><p>Sincronizando tu espacio de estudio…</p></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-wrap">
        <div className="status-panel">
          <p>Inicia sesión para acceder al mapa de estudio.</p>
          <Link className="button button-primary" href="/login">Ir a iniciar sesión <Icon name="arrow" size={16} /></Link>
        </div>
      </div>
    );
  }

  if (progressError) {
    return (
      <div className="page-wrap">
        <div className="status-panel">
          <p role="alert">No se pudo cargar tu progreso: {progressError.message}</p>
          <button className="button button-quiet" type="button" onClick={() => void refreshProgress()}>
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="page-wrap">
        <div className="status-panel">
          <p>No se encontró la fila de progreso de esta cuenta.</p>
          <button className="button button-quiet" type="button" onClick={() => void refreshProgress()}>
            Volver a cargar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <section className="dashboard-hero">
        <div className="dashboard-copy">
          <span className="hero-index">RUTA DE APRENDIZAJE · ULEAM</span>
          <h1>Entrena tu mirada clínica, concepto a concepto.</h1>
          <p>
            Avanza por los procesos psicológicos y los síndromes psicopatológicos con práctica breve, retroalimentación y repaso.
          </p>
        </div>
        <div className="stats-grid" aria-label="Resumen de progreso del módulo">
          <article className="stat-card">
            <div className="stat-label"><Icon name="spark" size={15} /> XP acumulados</div>
            <div className="stat-value">{progress.total_xp.toLocaleString("es-EC")}<small>XP</small></div>
          </article>
          <article className="stat-card">
            <div className="stat-label"><Icon name="play" size={14} /> Unidades disponibles</div>
            <div className="stat-value">{availableCount}<small>de {activeModule.unitIds.length}</small></div>
          </article>
          <article className="stat-card">
            <div className="stat-label"><Icon name="target" size={15} /> Nivel Oro</div>
            <div className="stat-value">{masteredCount}<small>unidades</small></div>
          </article>
        </div>
      </section>

      {canResume && resumableUnit && (
        <aside className="resume-banner">
          <div className="resume-banner-copy">
            <span className="resume-banner-icon"><Icon name="bolt" size={18} /></span>
            <div>
              <strong>Hay una partida guardada</strong>
              <p>Unidad {resumableUnit.id} · {resumableUnit.title}</p>
            </div>
          </div>
          <button
            className="button button-primary"
            type="button"
            onClick={() => router.push(`/unit/${resumableUnit.id}/play`)}
          >
            Retomar partida <Icon name="arrow" size={16} />
          </button>
        </aside>
      )}

      <div className="module-switcher" role="tablist" aria-label="Módulos de estudio">
        {STUDY_MODULES.map((module) => (
          <button
            aria-controls="study-units-panel"
            aria-selected={activeModuleId === module.id}
            className="module-tab"
            id={`module-tab-${module.id}`}
            key={module.id}
            onClick={() => setActiveModuleId(module.id)}
            role="tab"
            type="button"
          >
            <strong>Módulo {module.id} · {module.id === 1 ? "Semiología" : "Síndromes"}</strong>
            <span>{module.id === 1 ? "Procesos y funciones psicológicas" : "Síndromes psicopatológicos"}</span>
          </button>
        ))}
      </div>

      <section
        aria-labelledby={`module-tab-${activeModule.id}`}
        className="unit-map"
        id="study-units-panel"
        role="tabpanel"
      >
        <div className="section-heading">
          <div>
            <h2>{activeModule.title}</h2>
            <p>{completedCount} de {activeModule.unitIds.length} unidades completadas al menos una vez</p>
          </div>
          <span className="section-count">{moduleUnits.length} UNIDADES</span>
        </div>

        <div className="unit-grid">
          {moduleUnits.map((unit) => {
            const isUnlocked = progress.unlocked_unit_ids.includes(unit.id as UnitId);
            const unitProgress = progress.unit_progress[unit.id];
            const mastery = unitProgress?.mastery ?? "none";
            const earnedMastery = masteryLabel(mastery);
            const isInProgress = activeSession?.phase === "active" && activeSession.unitId === unit.id;
            const stateText = !isUnlocked ? "Bloqueada" : isInProgress ? "En curso" : "Disponible";

            return (
              <button
                aria-label={`Unidad ${unit.order}: ${unit.title}. ${stateText}${earnedMastery ? `. ${earnedMastery}` : ""}`}
                className={`unit-card ${!isUnlocked ? "is-locked" : isInProgress ? "is-in-progress" : "is-available"}`}
                disabled={!isUnlocked}
                key={unit.id}
                onClick={() => openUnit(unit)}
                type="button"
              >
                <span className="unit-card-top">
                  <span className="unit-number">UNIDAD {String(unit.order).padStart(2, "0")}</span>
                  <span className="unit-state"><span className="state-dot" />{stateText}</span>
                </span>
                <span className="unit-card-title">{unit.title}</span>
                <span className="unit-card-bottom">
                  {earnedMastery ? (
                    <span className={`mastery-badge ${masteryClass(mastery)}`}>
                      <Icon name="spark" size={12} /> {earnedMastery}
                    </span>
                  ) : unitProgress?.completionCount ? (
                    <span>{unitProgress.completionCount} {unitProgress.completionCount === 1 ? "completada" : "completadas"}</span>
                  ) : isUnlocked ? (
                    <span>Inicia tu práctica</span>
                  ) : (
                    <span className="locked-note"><Icon name="lock" size={13} /> Completa la unidad anterior</span>
                  )}
                  {isUnlocked && <Icon name="chevron" size={16} />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="dashboard-footnote">Las unidades se habilitan en secuencia. Cada victoria eleva su nivel de maestría.</p>
      </section>

      <KeyNotesModal
        notes={notes}
        onClose={closeNotes}
        onStart={startSelectedUnit}
        open={notesOpen}
        resume={Boolean(selectedUnit && activeSession?.phase === "active" && activeSession.unitId === selectedUnit.id)}
      />
    </div>
  );
}
