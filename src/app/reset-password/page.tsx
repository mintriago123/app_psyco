"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppState } from "../../components/AppProviders";
import { Icon } from "../../components/Icon";
import { signOut, updatePassword } from "../../lib/supabase/auth.service";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading: sessionLoading, setSession } = useAppState();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message || "No se pudo actualizar la contraseña.");
      return;
    }
    setUpdated(true);
  }

  async function returnToSignIn() {
    setError(null);
    const result = await signOut();
    if (result.error) {
      setError("La contraseña se actualizó, pero no se pudo cerrar la sesión. Inténtalo de nuevo.");
      return;
    }
    setSession(null);
    router.replace("/login");
    router.refresh();
  }

  if (sessionLoading) {
    return <div className="page-wrap"><div className="status-panel" role="status"><p>Validando el enlace de recuperación…</p></div></div>;
  }

  if (!user) {
    return (
      <section className="auth-layout reset-password-layout page-wrap">
        <div className="auth-card glass-card reset-password-card">
          <div className="auth-card-head">
            <span className="auth-card-icon"><Icon name="mark" size={22} /></span>
            <div><span className="eyebrow">RECUPERACIÓN DE CUENTA</span><h1>El enlace no está disponible</h1></div>
          </div>
          <p className="auth-caption">El enlace pudo haber vencido o ya se utilizó. Solicita uno nuevo desde el inicio de sesión.</p>
          <Link className="button button-primary auth-submit" href="/login">Volver a iniciar sesión <Icon name="arrow" size={17} /></Link>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-layout reset-password-layout page-wrap">
      <div className="auth-card glass-card reset-password-card">
        <div className="auth-card-head">
          <span className="auth-card-icon"><Icon name={updated ? "check" : "mark"} size={22} /></span>
          <div>
            <span className="eyebrow">RECUPERACIÓN DE CUENTA</span>
            <h1>{updated ? "Contraseña actualizada" : "Crea una contraseña nueva"}</h1>
          </div>
        </div>
        {updated ? (
          <>
            <p className="auth-caption">Tu contraseña ya cambió. Cierra esta sesión para volver a iniciar con la nueva.</p>
            {error && <p className="form-message form-message-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" type="button" onClick={() => void returnToSignIn()}>
              Ir a iniciar sesión <Icon name="arrow" size={17} />
            </button>
          </>
        ) : (
          <>
            <p className="auth-caption">Estás actualizando la contraseña de {user.email ?? "tu cuenta"}.</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label htmlFor="new-password">Nueva contraseña</label>
              <input
                autoComplete="new-password"
                id="new-password"
                minLength={8}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <label htmlFor="confirm-new-password">Confirma la contraseña</label>
              <input
                autoComplete="new-password"
                id="confirm-new-password"
                minLength={8}
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {error && <p className="form-message form-message-error" role="alert">{error}</p>}
              <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Actualizando…" : "Guardar contraseña"}
                {!submitting && <Icon name="arrow" size={17} />}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
