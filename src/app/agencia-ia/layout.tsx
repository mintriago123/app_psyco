import type { Metadata } from "next";
import { AgencyThemeProvider } from "../../components/agency/AgencyThemeProvider";

export const metadata: Metadata = {
  title: "Agencia de automatización con IA",
  description:
    "Una plantilla completa de agencia de automatización con IA, integrada con páginas de inicio, casos de estudio y detalle de proyectos.",
};

export default function AgencyLayout({ children }: LayoutProps<"/agencia-ia">) {
  return <AgencyThemeProvider>{children}</AgencyThemeProvider>;
}
