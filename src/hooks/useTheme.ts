"use client";

import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "psyco-theme";
type Theme = "light" | "dark";

/** Lee el tema inicial desde localStorage. Retorna "light" si no hay nada guardado. */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // El tema sigue funcionando durante esta sesión si el navegador bloquea storage.
  }

  return "light";
}

/** Aplica el atributo data-theme al <html> y persiste en localStorage. */
function applyTheme(theme: Theme) {
  const html = document.documentElement;

  html.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // El cambio visual no depende de que el navegador permita persistirlo.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  // Reaplica el valor guardado antes del pintado, también tras el remount de Strict Mode.
  useLayoutEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }, [theme]);

  return { theme, toggle };
}
