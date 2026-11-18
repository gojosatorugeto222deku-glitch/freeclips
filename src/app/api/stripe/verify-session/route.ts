import { NextRequest, NextResponse } from "next/server";
import {
  getStripeRouteErrorInfo,
  verifyStripeCheckoutSession,
} from "@/lib/stripeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: unknown;
    };
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : "";

    if (!sessionId) {
      return NextResponse.json(
        { verified: false, error: "Falta el identificador de la sesión." },
        { status: 400 }
      );
    }

    const result = await verifyStripeCheckoutSession(sessionId);
    if (!result.verified) {
      return NextResponse.json(result, { status: 402 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const { status, message } = getStripeRouteErrorInfo(err);
    return NextResponse.json({ verified: false, error: message }, { status });
  }
}
