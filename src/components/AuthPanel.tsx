"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { requestPasswordReset, signIn, signUp } from "../lib/supabase/auth.service";
import { Icon } from "./Icon";
import { useAppState } from "./AppProviders";

interface AuthPanelProps {
  mode: "login" | "register";
}

function getAuthErrorMessage(error: Error): string {
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message = error.message.toLowerCase();

  if (
    code === "over_email_send_rate_limit" ||
    message.includes("email rate limit exceeded")
  ) {
    return "Se alcanzó el límite de correos de confirmación de Supabase. Espera a que se libere o configura un proveedor SMTP en Authentication para habilitar más registros.";
  }

  if (
    code === "over_request_rate_limit" ||
    message.includes("too many requests")
  ) {
    return "Se hicieron demasiados intentos en poco tiempo. Espera unos minutos e inténtalo de nuevo.";
  }

  return error.message || "No se pudo completar la solicitud.";
}

function getRecoveryErrorMessage(error: Error): string {
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = error.message.toLowerCase();
  if (code === "over_email_send_rate_limit" || message.includes("email rate limit exceeded")) {
    return "Se alcanzó el límite de correos. Espera unos minutos antes de solicitar otro enlace.";
  }
  if (code === "over_request_rate_limit" || message.includes("too many requests")) {
    return "Se hicieron demasiadas solicitudes en poco tiempo. Espera unos minutos e inténtalo de nuevo.";
  }
  return error.message || "No se pudo enviar el enlace. Inténtalo de nuevo.";
}

export function AuthPanel({ mode }: AuthPanelProps) {
  const router = useRouter();
  const { user, loading: sessionLoading, setSession } = useAppState();
  const [currentMode, setCurrentMode] = useState(mode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySent, setRecoverySent] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const recoveryEmailRef = useRef<HTMLInputElement>(null);
  const recoveryTriggerRef = useRef<HTMLButtonElement>(null);
  const recoveryDialogRef = useRef<HTMLElement>(null);
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const registerTabRef = useRef<HTMLButtonElement>(null);
  const isRegister = currentMode === "register";

  useEffect(() => {
    if (!sessionLoading && user) router.replace("/");
  }, [router, sessionLoading, user]);

  useEffect(() => {
    if (!recoveryOpen) return;
    const recoveryTrigger = recoveryTriggerRef.current;
    const focusFrame = window.requestAnimationFrame(() => recoveryEmailRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRecoveryOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = recoveryDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      recoveryTrigger?.focus();
    };
  }, [recoveryOpen]);

  function changeMode(nextMode: AuthPanelProps["mode"]) {
    if (nextMode === currentMode) return;

    setCurrentMode(nextMode);
    setError(null);
    setMessage(null);
    window.history.replaceState(null, "", nextMode === "register" ? "/register" : "/login");
  }

  function openRecovery() {
    setRecoveryEmail(emailInputRef.current?.value.trim() ?? "");
    setRecoveryError(null);
    setRecoverySent(false);
    setRecoveryOpen(true);
  }

  async function handleRecoverySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoverySubmitting(true);
    setRecoveryError(null);
    const result = await requestPasswordReset(recoveryEmail.trim());
    setRecoverySubmitting(false);
    if (result.error) {
      setRecoveryError(getRecoveryErrorMessage(result.error));
      return;
    }
    setRecoverySent(true);
  }

  function handleModeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const nextMode = currentMode === "login" ? "register" : "login";
    changeMode(nextMode);
    (nextMode === "login" ? loginTabRef : registerTabRef).current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result = isRegister
      ? await signUp(email, password)
      : await signIn(email, password);

    setSubmitting(false);
    if (result.error) {
      setError(getAuthErrorMessage(result.error));
      return;
    }

    if (result.data?.session) {
      setSession(result.data.session);
      router.replace("/");
      router.refresh();
      return;
    }

    if (isRegister && result.data?.user) {
      setMessage("Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.");
      return;
    }

    setError("No se recibió una sesión. Comprueba tus datos e inténtalo de nuevo.");
  }

  return (
    <section className="auth-layout page-wrap">
      <div className="auth-intro">
        <span className="eyebrow"><Icon name="spark" size={15} /> ENTRENAMIENTO CLÍNICO</span>
        <h1>{isRegister ? "Empieza tu ruta de estudio." : "Vuelve a tu práctica clínica."}</h1>
        <p>
          Repasa los conceptos de Psicopatología I, resuelve retos y conserva tu avance en todos tus dispositivos.
        </p>
        <div className="auth-proof-row">
          <span><Icon name="check" size={16} /> 8 unidades de estudio</span>
          <span><Icon name="check" size={16} /> Progreso sincronizado</span>
        </div>
        <div className="auth-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-one" />
          <div className="orbit-ring orbit-ring-two" />
          <div className="orbit-core"><Icon name="mark" size={34} /></div>
          <span className="orbit-dot orbit-dot-one" />
          <span className="orbit-dot orbit-dot-two" />
          <span className="orbit-dot orbit-dot-three" />
        </div>
      </div>

      <div className="auth-card glass-card">
        <div className="auth-card-head">
          <span className="auth-card-icon"><Icon name={isRegister ? "spark" : "mark"} size={22} /></span>
          <div>
            <span className="eyebrow">CUENTA PERSONAL</span>
            <h2>{isRegister ? "Crear cuenta" : "Iniciar sesión"}</h2>
          </div>
        </div>
        <p className="auth-caption">
          {isRegister ? "Tu recorrido queda guardado en la nube." : "Continúa donde dejaste tu estudio."}
        </p>

        <div
          className="auth-mode-tabs"
          role="tablist"
          aria-label="Modo de autenticación"
          data-mode={currentMode}
          onKeyDown={handleModeKeyDown}
        >
          <span className="auth-mode-slider" aria-hidden="true" />
          <button
            ref={loginTabRef}
            id="auth-tab-login"
            className="auth-mode-tab"
            type="button"
            role="tab"
            aria-selected={currentMode === "login"}
            aria-controls="auth-form"
            tabIndex={currentMode === "login" ? 0 : -1}
            onClick={() => changeMode("login")}
          >
            Iniciar sesión
          </button>
          <button
            ref={registerTabRef}
            id="auth-tab-register"
            className="auth-mode-tab"
            type="button"
            role="tab"
            aria-selected={currentMode === "register"}
            aria-controls="auth-form"
            tabIndex={currentMode === "register" ? 0 : -1}
            onClick={() => changeMode("register")}
          >
            Crear cuenta
          </button>
        </div>

        <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Correo electrónico</label>
          <input
            ref={emailInputRef}
            autoComplete="email"
            id="auth-email"
            name="email"
            type="email"
            placeholder="nombre@correo.com"
            required
          />
          <label htmlFor="auth-password">Contraseña</label>
          <input
            autoComplete={isRegister ? "new-password" : "current-password"}
            id="auth-password"
            name="password"
            type="password"
            placeholder={isRegister ? "Al menos 8 caracteres" : "Tu contraseña"}
            minLength={isRegister ? 8 : undefined}
            required
          />
          {!isRegister && (
            <button
              ref={recoveryTriggerRef}
              className="auth-recovery-trigger"
              type="button"
              onClick={openRecovery}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {error && <p className="form-message form-message-error" role="alert">{error}</p>}
          {message && <p className="form-message form-message-success" role="status">{message}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Procesando…" : isRegister ? "Crear mi cuenta" : "Entrar al mapa"}
            {!submitting && <Icon name="arrow" size={18} />}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"}{" "}
          <button
            type="button"
            onClick={() => changeMode(isRegister ? "login" : "register")}
          >
            {isRegister ? "Inicia sesión" : "Crea una cuenta"}
          </button>
        </p>
      </div>

      {recoveryOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !recoverySubmitting) setRecoveryOpen(false);
          }}
        >
          <section
            ref={recoveryDialogRef}
            aria-labelledby="password-recovery-title"
            aria-modal="true"
            className="confirmation-modal password-recovery-modal glass-card"
            role="dialog"
            tabIndex={-1}
          >
            <button
              className="icon-button password-recovery-close"
              type="button"
              aria-label="Cerrar recuperación de contraseña"
              disabled={recoverySubmitting}
              onClick={() => setRecoveryOpen(false)}
            >
              <Icon name="close" size={18} />
            </button>
            <span className="confirmation-icon"><Icon name="mark" size={20} /></span>
            <h2 id="password-recovery-title">Recuperar contraseña</h2>
            {recoverySent ? (
              <>
                <p>Si existe una cuenta asociada a ese correo, recibirás un enlace para crear una contraseña nueva.</p>
                <div className="confirmation-actions">
                  <button className="button button-primary" type="button" onClick={() => setRecoveryOpen(false)}>Entendido</button>
                </div>
              </>
            ) : (
              <>
                <p>Escribe el correo de tu cuenta y te enviaremos un enlace para restablecer la contraseña.</p>
                <form className="auth-form password-recovery-form" onSubmit={handleRecoverySubmit}>
                  <label htmlFor="recovery-email">Correo electrónico</label>
                  <input
                    ref={recoveryEmailRef}
                    autoComplete="email"
                    id="recovery-email"
                    name="email"
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(event) => setRecoveryEmail(event.target.value)}
                  />
                  {recoveryError && <p className="form-message form-message-error" role="alert">{recoveryError}</p>}
                  <div className="confirmation-actions">
                    <button className="button button-quiet" type="button" disabled={recoverySubmitting} onClick={() => setRecoveryOpen(false)}>Cancelar</button>
                    <button className="button button-primary" type="submit" disabled={recoverySubmitting}>
                      {recoverySubmitting ? "Enviando…" : "Enviar enlace"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
