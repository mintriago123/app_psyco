"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppProviders } from "./AppProviders";
import { Navbar } from "./Navbar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAgencyRoute = pathname === "/agencia-ia" || pathname.startsWith("/agencia-ia/");

  if (isAgencyRoute) {
    return <div className="app-main" id="main-content">{children}</div>;
  }

  return (
    <AppProviders>
      <Navbar />
      <main className="app-main" id="main-content">{children}</main>
    </AppProviders>
  );
}
