import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Conoce cómo FreeClips protege tu privacidad procesando tus videos directamente en tu dispositivo.",
};

export default function PrivacidadPage() {
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
              Política de Privacidad
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Última actualización: noviembre de 2026
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">
              1. Procesamiento privado de tus videos
            </h2>
            <p>
              FreeClips transcribe el audio y renderiza los subtítulos directamente
              en el navegador de tu dispositivo. Tus archivos de video y audio no
              se suben ni se almacenan en servidores propios de FreeClips.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">
              2. Datos de cuenta y preferencias locales
            </h2>
            <p>
              Usamos almacenamiento local del navegador para recordar tu cuota
              diaria gratuita y el estado de tu plan. Si decides conectar tu cuenta
              de Google mediante Firebase Authentication para acceder al descuento
              del Plan Creador, solo recibimos tu nombre, correo electrónico y foto
              de perfil asociados a esa sesión.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">
              3. Pagos con Stripe
            </h2>
            <p>
              Las suscripciones del Plan Creador se procesan de forma segura a
              través de Stripe. FreeClips nunca ve ni almacena los datos completos
              de tu tarjeta bancaria; únicamente consultamos el estado de tu
              suscripción o sesión mediante el identificador de pago y el correo
              asociado en Stripe.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">
              4. Contacto
            </h2>
            <p>
              Si tienes dudas sobre privacidad o deseas solicitar información sobre
              tu cuenta, escríbenos a{" "}
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
