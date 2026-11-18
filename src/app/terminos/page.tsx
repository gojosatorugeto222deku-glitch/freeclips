import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Términos de Servicio",
  description:
    "Condiciones de uso del editor de subtítulos FreeClips y de la suscripción Plan Creador.",
};

export default function TerminosPage() {
  return (
    <div className="studio-grid-bg min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
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
              Términos de Servicio
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Última actualización: noviembre de 2026
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">
              1. Uso del servicio
            </h2>
            <p>
              FreeClips ofrece herramientas en línea para generar, editar y
              exportar subtítulos en video. Conservas el 100% de los derechos
              sobre el contenido que procesas y exportas con la plataforma.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">
              2. Planes y suscripciones
            </h2>
            <p>
              El Plan Gratuito incluye 5 videos diarios de hasta 90 segundos sin
              marca de agua, ampliables mediante recargas gratuitas dentro de la
              web. El Plan Creador amplía los límites diarios, duración máxima de
              video, edición visual avanzada y conversión 9:16 por una tarifa
              mensual recurrente procesada en Stripe.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">
              3. Cancelación y soporte
            </h2>
            <p>
              Puedes cancelar tu suscripción mensual en cualquier momento antes del
              siguiente ciclo de facturación. Para soporte de facturación o dudas
              técnicas, contáctanos en{" "}
              <a
                href="mailto:seinendeku222@gmail.com"
                className="text-yellow-300 underline hover:text-yellow-200"
              >
                seinendeku222@gmail.com
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
