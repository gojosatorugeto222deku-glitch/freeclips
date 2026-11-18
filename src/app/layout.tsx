import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const uiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700", "800"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://freeclips.up.railway.app";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: {
    default: "FreeClips — Subtítulos automáticos sin marca de agua",
    template: "%s · FreeClips",
  },
  description:
    "Crea subtítulos dinámicos en español para tus videos cortos (MP4 y MOV) directo en la web, sin marca de agua ni registro. Exporta en MP4 HD listo para TikTok, Reels y Shorts.",
  keywords: [
    "subtítulos automáticos",
    "subtítulos sin marca de agua",
    "subtítulos tiktok reels shorts",
    "poner subtítulos a video gratis",
    "FreeClips",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/",
    siteName: "FreeClips",
    title: "FreeClips — Subtítulos automáticos sin marca de agua",
    description:
      "Transcribe y anima subtítulos en español para TikTok, Instagram Reels y YouTube Shorts directo en tu navegador, gratis y sin marca de agua.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FreeClips — Subtítulos automáticos sin marca de agua",
    description:
      "Subtítulos automáticos con IA en español y exportación MP4 HD sin marca de agua.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${uiFont.variable} ${monoFont.variable} dark`}>
      <body className="min-h-screen bg-[#07080b] text-zinc-100 antialiased selection:bg-yellow-400/30 selection:text-yellow-100">
        {children}
      </body>
    </html>
  );
}
