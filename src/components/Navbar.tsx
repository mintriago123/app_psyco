"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "../lib/supabase/auth.service";
import { useAppState } from "./AppProviders";
import { Icon } from "./Icon";

export function Navbar() {
  const router = useRouter();
  const { user, progress, setSession } = useAppState();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const initials = user?.email?.slice(0, 1).toLocaleUpperCase("es-EC") ?? "E";
  const vaultCount = progress?.error_chest_question_ids.length ?? 0;

  async function handleSignOut() {
    setSignOutError(null);
    const result = await signOut();
    if (result.error) {
      setSignOutError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
      return;
    }
    setSession(null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="site-nav">
      <nav className="nav-inner" aria-label="Navegación principal">
        <Link className="brand-lockup" href="/" aria-label="Psicopatología I, mapa de estudio">
          <span className="brand-mark"><Icon name="mark" size={22} /></span>
          <span className="brand-copy">
            <strong>Psicopatología I</strong>
            <span>Semiología y Fenomenología</span>
          </span>
        </Link>

        <div className="nav-actions">
          {user ? (
            <>
              <div className="nav-primary-links">
                <Link href="/">Mapa</Link>
                <Link className="nav-vault-link" href="/error-vault">
                  Baúl <span className="nav-vault-count" aria-label={`${vaultCount} preguntas pendientes`}>{vaultCount}</span>
                </Link>
              </div>
              <div className="xp-chip" aria-label={`${(progress?.total_xp ?? 0).toLocaleString("es-EC")} XP acumulados`}>
                <Icon name="spark" size={17} />
                <span>{(progress?.total_xp ?? 0).toLocaleString("es-EC")}</span>
                <small>XP</small>
              </div>
              <Link className="session-chip" href="/profile" title={`Perfil de ${user.email ?? "estudiante"}`} aria-label="Abrir perfil de estudiante">
                <span className="session-avatar" aria-hidden="true">{initials}</span>
                <span className="session-name">{user.email ?? "Estudiante"}</span>
              </Link>
              <button className="nav-signout" type="button" onClick={handleSignOut}>
                <span>Cerrar sesión</span>
                <Icon name="arrow" size={16} />
              </button>
            </>
          ) : (
            <Link href="/login" className="nav-signout">
              Iniciar sesión <Icon name="arrow" size={16} />
            </Link>
          )}
        </div>
      </nav>
      {user && (
        <nav className="nav-sections" aria-label="Secciones de estudio">
          <Link href="/" aria-label="Mapa de estudio">
            <Icon name="target" size={15} /><span>Mapa</span>
          </Link>
          <Link href="/error-vault" aria-label={`Baúl de Errores, ${vaultCount} preguntas pendientes`}>
            <Icon name="book" size={15} /><span>Baúl</span><span className="nav-vault-count">{vaultCount}</span>
          </Link>
          <Link href="/profile" aria-label="Perfil y medallas">
            <Icon name="mark" size={15} /><span>Perfil</span>
          </Link>
        </nav>
      )}
      {signOutError && <p className="nav-error" role="status">{signOutError}</p>}
    </header>
  );
}
