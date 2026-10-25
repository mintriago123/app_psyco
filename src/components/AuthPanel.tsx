"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { signIn, signUp } from "../lib/supabase/auth.service";
import { Icon } from "./Icon";
import { useAppState } from "./AppProviders";

interface AuthPanelProps {
  mode: "login" | "register";
}

export function AuthPanel({ mode }: AuthPanelProps) {
  const router = useRouter();
  const { user, loading: sessionLoading, setSession } = useAppState();
  const [currentMode, setCurrentMode] = useState(mode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const registerTabRef = useRef<HTMLButtonElement>(null);
  const isRegister = currentMode === "register";

  useEffect(() => {
    setCurrentMode(mode);
    setError(null);
    setMessage(null);
  }, [mode]);

  useEffect(() => {
    if (!sessionLoading && user) router.replace("/");
  }, [router, sessionLoading, user]);

  function changeMode(nextMode: AuthPanelProps["mode"]) {
    if (nextMode === currentMode) return;

    setCurrentMode(nextMode);
    setError(null);
    setMessage(null);
    window.history.replaceState(null, "", nextMode === "register" ? "/register" : "/login");
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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
      setError(result.error.message || "No se pudo completar la solicitud.");
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
    </section>
  );
}
