import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Canales oficiales de contacto y soporte de FreeClips para dudas técnicas, facturación en Stripe y privacidad.",
};

export default function ContactoPage() {
  return (
    <div className="studio-grid-bg flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo size={34} />
            <span className="text-lg font-bold text-white">FreeClips</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.09]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al editor
          </Link>
        </div>

        <article className="space-y-6 rounded-2xl border border-white/[0.08] bg-[#0f1117]/95 p-6 text-sm leading-relaxed text-zinc-300 sm:p-8">
          <header>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Contacto y Soporte
            </h1>
            <p className="mt-1.5 text-xs text-zinc-400">
              Atención directa sobre el editor de subtítulos, suscripciones del
              Plan Creador y solicitudes de privacidad.
            </p>
          </header>

          <div className="rounded-xl border border-yellow-400/25 bg-yellow-400/[0.06] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400/15 text-yellow-300">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white">
                  Correo oficial de soporte
                </h2>
                <p className="mt-1 text-xs text-zinc-300">
                  Escríbenos directamente y te responderemos en un plazo habitual
                  de 24 a 48 horas hábiles.
                </p>
                <a
                  href="mailto:seinendeku222@gmail.com?subject=Soporte%20FreeClips"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-yellow-300"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>seinendeku222@gmail.com</span>
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <MessageSquare className="h-4 w-4 text-cyan-400" />
                <span>Pagos y facturación</span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                Si ya pagaste el Plan Creador y cambiaste de navegador, también
                puedes reactivarlo al instante en{" "}
                <strong className="text-zinc-200">
                  Planes Pro → Activar o restaurar Plan Creador
                </strong>{" "}
                usando el correo con el que pagaste.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Privacidad y cumplimiento</span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                Consulta nuestra{" "}
                <Link
                  href="/privacidad"
                  className="text-yellow-300 underline hover:text-yellow-200"
                >
                  Política de Privacidad
                </Link>{" "}
                y los{" "}
                <Link
                  href="/terminos"
                  className="text-yellow-300 underline hover:text-yellow-200"
                >
                  Términos de Uso
                </Link>{" "}
                de FreeClips.
              </p>
            </div>
          </div>
        </article>
      </div>

      <SiteFooter />
    </div>
  );
}
