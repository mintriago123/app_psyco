"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "psyco-theme";

/** Lee el tema inicial desde localStorage. Retorna "light" si no hay nada guardado. */
function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light"; // predeterminado: claro
}

/** Aplica el atributo data-theme al <html> y persiste en localStorage. */
function applyTheme(theme: "light" | "dark") {
  const html = document.documentElement;
  if (theme === "dark") {
    html.setAttribute("data-theme", "dark");
  } else {
    html.removeAttribute("data-theme");
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Sincronizar con localStorage al montar (evita hidratación desincronizada)
  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle } as const;
}
