import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "../components/AppProviders";
import { Navbar } from "../components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Psicopatología I | Semiología y Fenomenología",
  description: "Plataforma de práctica para Psicopatología I de ULEAM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Script inline anti-flash: aplica data-theme ANTES del primer paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('psyco-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="app-body">
        <a className="skip-link" href="#main-content">Saltar al contenido</a>
        <AppProviders>
          <Navbar />
          <main className="app-main" id="main-content">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
