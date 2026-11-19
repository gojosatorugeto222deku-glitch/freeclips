"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

interface SiteFooterProps {
  onOpenProModal?: () => void;
}

export function SiteFooter({ onOpenProModal }: SiteFooterProps) {
  return (
    <footer className="relative border-t border-white/[0.07] bg-[#050609]/95 py-8 text-xs text-zinc-400">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-5 px-4 sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={26} />
            <Link
              href="/"
              className="text-sm font-bold tracking-tight text-white hover:text-yellow-300 transition"
            >
              FreeClips
            </Link>
          </div>
          <span className="hidden text-zinc-700 sm:inline">·</span>
          <span className="inline-flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Procesamiento privado en tu navegador · Sin marca de agua
          </span>
        </div>

        <nav
          aria-label="Enlaces legales y contacto"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-zinc-300"
        >
          {onOpenProModal ? (
            <button
              type="button"
              onClick={onOpenProModal}
              className="transition hover:text-yellow-300"
            >
              Planes Pro
            </button>
          ) : (
            <Link href="/#planes" className="transition hover:text-yellow-300">
              Planes Pro
            </Link>
          )}
          <Link href="/privacidad" className="transition hover:text-white">
            Política de Privacidad
          </Link>
          <Link href="/terminos" className="transition hover:text-white">
            Términos de Uso
          </Link>
          <Link href="/contacto" className="transition hover:text-white">
            Contacto
          </Link>
          <span className="text-zinc-600">© 2026 FreeClips</span>
        </nav>
      </div>
    </footer>
  );
}
