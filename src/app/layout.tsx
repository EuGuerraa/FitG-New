import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Schibsted_Grotesk, Kode_Mono } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import "./globals.css";

// Fundição: display com eixo óptico, texto em grotesca contemporânea,
// dados em mono. Carregadas pelo next/font — sem requisição a terceiros.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  axes: ["opsz"],
  display: "swap",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

const kode = Kode_Mono({
  subsets: ["latin"],
  variable: "--font-kode",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FitG",
  description: "Treino, nutrição e acompanhamento, no mesmo lugar.",
  applicationName: "FitG",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FitG",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#14110E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${bricolage.variable} ${schibsted.variable} ${kode.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
