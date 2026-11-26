"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { requestPasswordReset, signIn, signUp } from "../lib/supabase/auth.service";
import { Icon } from "./Icon";
import { useAppState } from "./AppProviders";
import "./AuthPanel.css";

interface AuthPanelProps {
  mode: "login" | "register";
}

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_STRENGTH_LABELS = ["", "Débil", "Media", "Fuerte"] as const;

function getPasswordStrength(password: string) {
  if (!password) return 0;

  const normalized = password.normalize("NFKC").toLowerCase();
  const diversity = new Set(normalized).size;
  const predictable =
    /^(?:password|contrase[ñn]a|qwerty|12345678|abcdefgh)[\p{N}\p{P}\p{S}]*$/u.test(normalized) ||
    /^([\s\S]{1,4})\1+$/u.test(normalized);
  if (password.length < MIN_PASSWORD_LENGTH || diversity < 4 || predictable) return 1;

  const characterTypes = [/\p{L}/u, /\p{Lu}/u, /\p{N}/u, /[\p{P}\p{S}]/u]
    .filter((pattern) => pattern.test(password)).length;
  if (diversity >= 8 && (password.length >= 20 || (password.length >= 14 && characterTypes >= 3))) return 3;

  return password.length >= 12 || characterTypes >= 3 ? 2 : 1;
}

function getAuthErrorMessage(error: Error): string {
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message = error.message.toLowerCase();

  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    message.includes("email rate limit exceeded") ||
    message.includes("too many requests")
  ) {
    return "Se hicieron demasiados intentos en poco tiempo. Espera unos minutos e inténtalo de nuevo.";
  }

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "El correo o la contraseña son incorrectos.";
  }
  if (code === "weak_password" || error.name === "AuthWeakPasswordError") {
    return "Elige una contraseña más segura de al menos 8 caracteres.";
  }
  if (code === "email_exists" || code === "user_already_exists") {
    return "Si ya tienes una cuenta con ese correo, inicia sesión o recupera tu contraseña.";
  }
  if (code === "request_timeout" || error.name === "AuthRetryableFetchError") {
    return "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";
  }

  return "No pudimos completar la solicitud. Inténtalo de nuevo.";
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
  return "No se pudo enviar el enlace. Inténtalo de nuevo.";
}

export function AuthPanel({ mode }: AuthPanelProps) {
  const router = useRouter();
  const { user, loading: sessionLoading, setSession } = useAppState();
  const [currentMode, setCurrentMode] = useState(mode);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordTooShort, setPasswordTooShort] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySent, setRecoverySent] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const submissionInFlight = useRef(false);
  const recoveryEmailRef = useRef<HTMLInputElement>(null);
  const recoveryTriggerRef = useRef<HTMLButtonElement>(null);
  const recoveryDialogRef = useRef<HTMLElement>(null);
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const registerTabRef = useRef<HTMLButtonElement>(null);
  const isRegister = currentMode === "register";
  const submitLabel = isRegister ? "Crear cuenta" : "Iniciar sesión";
  const submittingLabel = isRegister ? "Creando cuenta…" : "Iniciando sesión…";

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
    if (submissionInFlight.current || nextMode === currentMode) return;

    setCurrentMode(nextMode);
    setPasswordStrength(0);
    setPasswordTooShort(false);
    setError(null);
    setNeedsSignIn(false);
    window.history.replaceState(null, "", nextMode === "register" ? "/register" : "/login");
    (nextMode === "login" ? loginTabRef : registerTabRef).current?.focus();
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
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") changeMode("login");
    else if (event.key === "End") changeMode("register");
    else changeMode(isRegister ? "login" : "register");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current || needsSignIn) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    submissionInFlight.current = true;
    setSubmitting(true);
    setError(null);

    const result = isRegister
      ? await signUp(email, password)
      : await signIn(email, password);

    if (result.data?.session) {
      setSession(result.data.session);
      router.replace("/");
      router.refresh();
      return;
    }

    submissionInFlight.current = false;
    setSubmitting(false);
    if (result.error) {
      setError(getAuthErrorMessage(result.error));
      return;
    }

    if (isRegister && result.data?.user) {
      setNeedsSignIn(true);
      return;
    }

    setError("No se recibió una sesión. Comprueba tus datos e inténtalo de nuevo.");
  }

  return (
    <section className="auth-layout page-wrap">
      <div className="auth-card auth-access-card glass-card">
        <div className="auth-card-head">
          <span className="auth-card-icon"><Icon name={isRegister ? "spark" : "mark"} size={22} /></span>
          <h1>{isRegister ? "Crea tu cuenta en PsiQuest" : "Inicia sesión en PsiQuest"}</h1>
        </div>
        <p className="auth-caption">
          {isRegister
            ? "Crea tu cuenta y entra directamente al mapa."
            : "Usa tu correo y contraseña para continuar tu estudio."}
        </p>

        <div
          className="auth-mode-tabs"
          role="tablist"
          aria-label="Modo de autenticación"
          onKeyDown={handleModeKeyDown}
        >
          <button
            ref={loginTabRef}
            id="auth-tab-login"
            className="auth-mode-tab"
            type="button"
            role="tab"
            aria-selected={currentMode === "login"}
            aria-controls="auth-mode-panel"
            disabled={submitting}
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
            aria-controls="auth-mode-panel"
            disabled={submitting}
            tabIndex={currentMode === "register" ? 0 : -1}
            onClick={() => changeMode("register")}
          >
            Crear cuenta
          </button>
        </div>

        <div id="auth-mode-panel" role="tabpanel" aria-labelledby={`auth-tab-${currentMode}`}>
          <form id="auth-form" className="auth-form" aria-busy={submitting} onSubmit={handleSubmit}>
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              ref={emailInputRef}
              autoComplete="username"
              id="auth-email"
              name="email"
              type="email"
              placeholder="nombre@correo.com"
              readOnly={submitting}
              required
            />
            <label htmlFor="auth-password">Contraseña</label>
            <input
              key={currentMode}
              autoComplete={isRegister ? "new-password" : "current-password"}
              aria-describedby={isRegister
                ? `auth-password-hint auth-password-strength${passwordTooShort ? " auth-password-error" : ""}`
                : undefined}
              aria-invalid={passwordTooShort || undefined}
              id="auth-password"
              name="password"
              type="password"
              minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
              onChange={isRegister ? (event) => {
                setPasswordStrength(getPasswordStrength(event.target.value));
                setPasswordTooShort(false);
              } : undefined}
              onInvalid={isRegister ? (event) => {
                if (!event.currentTarget.validity.tooShort) return;
                event.preventDefault();
                setPasswordTooShort(true);
                event.currentTarget.focus();
              } : undefined}
              readOnly={submitting}
              required
            />
            {isRegister && (
              <div className="auth-password-guide">
                <p id="auth-password-hint" className="auth-field-hint">Usa al menos {MIN_PASSWORD_LENGTH} caracteres.</p>
                {passwordTooShort && (
                  <p id="auth-password-error" className="auth-field-hint auth-field-error" role="alert">
                    Tu contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.
                  </p>
                )}
                <div className="auth-password-meter" data-strength={passwordStrength} aria-hidden="true">
                  {[1, 2, 3].map((level) => <span key={level} data-active={level <= passwordStrength} />)}
                </div>
                <p id="auth-password-strength" className="auth-field-hint" role="status">
                  Fortaleza estimada{passwordStrength > 0 && <> <strong>{PASSWORD_STRENGTH_LABELS[passwordStrength]}</strong></>}
                </p>
              </div>
            )}
            {!isRegister && (
              <button
                ref={recoveryTriggerRef}
                className="auth-recovery-trigger"
                type="button"
                disabled={submitting}
                onClick={openRecovery}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
            {error && <p className="form-message form-message-error" role="alert">{error}</p>}
            {needsSignIn ? (
              <>
                <p className="form-message" role="status">No pudimos iniciar sesión automáticamente.</p>
                <button className="button button-primary auth-submit" type="button" onClick={() => changeMode("login")}>
                  Ir a iniciar sesión <Icon name="arrow" size={18} />
                </button>
              </>
            ) : (
              <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
                {submitting ? submittingLabel : submitLabel}
                {!submitting && <Icon name="arrow" size={18} />}
              </button>
            )}
          </form>
        </div>

        <p className="auth-switch">
          {isRegister ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"}{" "}
          <button
            type="button"
            disabled={submitting}
            onClick={() => changeMode(isRegister ? "login" : "register")}
          >
            {isRegister ? "Inicia sesión" : "Crea una cuenta"}
          </button>
        </p>
      </div>

      <div className="auth-intro">
        <span className="eyebrow"><Icon name="spark" size={15} /> ENTRENAMIENTO CLÍNICO</span>
        <h2>Entrena tu mirada clínica.</h2>
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
