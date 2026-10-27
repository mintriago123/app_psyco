"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AgencyTheme = "system" | "light" | "dark";

const AgencyThemeContext = createContext<{
  theme: AgencyTheme;
  setTheme: (theme: AgencyTheme) => void;
} | null>(null);

export function AgencyThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AgencyTheme>("system");

  return (
    <AgencyThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </AgencyThemeContext.Provider>
  );
}

export function useAgencyTheme() {
  const context = useContext(AgencyThemeContext);
  if (!context) {
    throw new Error("useAgencyTheme debe usarse dentro de AgencyThemeProvider.");
  }
  return context;
}
