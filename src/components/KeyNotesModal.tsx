"use client";

import { useEffect } from "react";
import type { KeyNotes } from "../../types/spec";
import { Icon } from "./Icon";

interface KeyNotesModalProps {
  notes: KeyNotes | null;
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  resume?: boolean;
}

export function KeyNotesModal({
  notes,
  open,
  onClose,
  onStart,
  resume = false,
}: KeyNotesModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="key-notes-title"
        aria-modal="true"
        className="notes-modal glass-card"
        role="dialog"
        tabIndex={-1}
      >
        <header className="notes-modal-head">
          <div>
            <span className="eyebrow"><Icon name="book" size={15} /> PREPARACIÓN DE UNIDAD</span>
            <h2 id="key-notes-title">{notes?.title ?? "Apuntes clave"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar apuntes">
            <Icon name="close" />
          </button>
        </header>

        <div className="notes-modal-content">
          {notes ? (
            <>
              <p className="notes-summary">{notes.summary}</p>
              <section className="notes-section">
                <h3>Glosario esencial</h3>
                <div className="definition-list">
                  {notes.definitions.map(({ term, definition }) => (
                    <article className="definition-item" key={term}>
                      <h4>{term}</h4>
                      <p>{definition}</p>
                    </article>
                  ))}
                </div>
              </section>

              {notes.comparativeTables.map((table) => (
                <section className="notes-section" key={table.title}>
                  <h3>{table.title}</h3>
                  <div className="table-scroll" role="region" aria-label={table.title} tabIndex={0}>
                    <table className="notes-table">
                      <thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                      <tbody>
                        {table.rows.map((row, rowIndex) => (
                          <tr key={`${table.title}-${rowIndex}`}>
                            {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              <p className="source-note">
                Fuente oficial · páginas {notes.sourcePages.join(", ")}
              </p>
            </>
          ) : (
            <p className="form-message form-message-error">No se encontraron apuntes para esta unidad.</p>
          )}
        </div>

        <footer className="notes-modal-footer">
          <button className="button button-quiet" type="button" onClick={onClose}>Volver al mapa</button>
          <button className="button button-primary" type="button" onClick={onStart} disabled={!notes}>
            <Icon name={resume ? "arrow" : "play"} size={17} />
            {resume ? "Retomar partida" : "Iniciar partida"}
          </button>
        </footer>
      </section>
    </div>
  );
}
