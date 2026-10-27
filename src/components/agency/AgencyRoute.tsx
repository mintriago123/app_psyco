"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import LongExposureAgencyTemplate, {
  type AgencyPage,
} from "./LongExposureAgencyTemplate";
import { useAgencyTheme } from "./AgencyThemeProvider";

const sectionIds = new Set([
  "services",
  "process",
  "about",
  "clients",
  "stats",
  "work",
  "testimonials",
  "insights",
  "faq",
  "contact",
]);

function routeFor(page: AgencyPage) {
  if (page === "home") return "/agencia-ia";
  if (page === "cases") return "/agencia-ia/casos";
  if (page === "404") return "/agencia-ia/no-encontrado";
  return `/agencia-ia/casos/${encodeURIComponent(page.case)}`;
}

export function AgencyRoute({ initialPage }: { initialPage: AgencyPage }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useAgencyTheme();
  const handlePageChange = useCallback(
    (page: AgencyPage, section?: string) => {
      const destination = routeFor(page);
      const hash = section && sectionIds.has(section) ? `#${section}` : "";
      router.push(`${destination}${hash}`, { scroll: false });
    },
    [router],
  );

  return (
    <LongExposureAgencyTemplate
      key={pathname}
      defaultTheme={theme}
      initialPage={initialPage}
      onPageChange={handlePageChange}
      onThemeChange={setTheme}
    />
  );
}
