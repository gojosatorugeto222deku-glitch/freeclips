import { NextRequest, NextResponse } from "next/server";
import {
  createStripeCheckoutSession,
  getStripePriceId,
  getStripeRouteErrorInfo,
  getStripeSecretKey,
  type PublicCheckoutTier,
} from "@/lib/stripeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveTrustedOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fallback below
    }
  }
  const forwardedHost = req.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.trim() || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tier?: unknown;
      email?: unknown;
    };

    const tier: PublicCheckoutTier = body.tier === "3usd" ? "3usd" : "5usd";
    const customerEmail =
      typeof body.email === "string" ? body.email : undefined;

    if (!getStripeSecretKey() || !getStripePriceId(tier)) {
      return NextResponse.json(
        {
          configured: false,
          error:
            "El cobro automático con Stripe aún no está activo en este servidor. Si ya pagaste, usa 'Restaurar suscripción'.",
        },
        { status: 503 }
      );
    }

    const origin = resolveTrustedOrigin(req);
    const session = await createStripeCheckoutSession({
      tier,
      origin,
      customerEmail,
    });

    return NextResponse.json({
      configured: true,
      url: session.url,
      sessionId: session.sessionId,
    });
  } catch (err) {
    const { status, message } = getStripeRouteErrorInfo(err);
    return NextResponse.json({ configured: false, error: message }, { status });
  }
}
