"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

interface SiteFooterProps {
  onOpenProModal?: () => void;
}

export function SiteFooter({ onOpenProModal }: SiteFooterProps) {
  return (
    <footer className="border-t border-white/[0.06] bg-[#07080b]/90 py-6 text-xs text-zinc-400">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={24} />
          <Link href="/" className="font-semibold text-zinc-200 hover:text-white">
            FreeClips
          </Link>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">
            Subtítulos automáticos sin marca de agua
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
              className="transition hover:text-white"
            >
              Planes Pro
            </button>
          ) : (
            <Link href="/#planes" className="transition hover:text-white">
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
