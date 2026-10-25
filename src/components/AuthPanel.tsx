"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { signIn, signUp } from "../lib/supabase/auth.service";
import { Icon } from "./Icon";
import { useAppState } from "./AppProviders";

interface AuthPanelProps {
  mode: "login" | "register";
}

export function AuthPanel({ mode }: AuthPanelProps) {
  const router = useRouter();
  const { user, loading: sessionLoading, setSession } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isRegister = mode === "register";

  useEffect(() => {
    if (!sessionLoading && user) router.replace("/");
  }, [router, sessionLoading, user]);

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

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor={`${mode}-email`}>Correo electrónico</label>
          <input
            autoComplete="email"
            id={`${mode}-email`}
            name="email"
            type="email"
            placeholder="nombre@correo.com"
            required
          />
          <label htmlFor={`${mode}-password`}>Contraseña</label>
          <input
            autoComplete={isRegister ? "new-password" : "current-password"}
            id={`${mode}-password`}
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
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Inicia sesión" : "Crea una cuenta"}
          </Link>
        </p>
      </div>
    </section>
  );
}
