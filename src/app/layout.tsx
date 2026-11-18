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

export const metadata: Metadata = {
  title: "SubLimpio — Subtítulos automáticos sin marca de agua",
  description:
    "Agrega subtítulos automáticos en español a tus videos cortos (MP4/MOV) 100% en tu navegador, sin registro ni marcas de agua, con Whisper y FFmpeg.wasm.",
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
