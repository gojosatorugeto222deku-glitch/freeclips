import { NextRequest, NextResponse } from "next/server";
import {
  getStripeRouteErrorInfo,
  restoreCreatorSubscriptionByEmail,
} from "@/lib/stripeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: unknown;
    };
    const email = typeof body.email === "string" ? body.email : "";

    const result = await restoreCreatorSubscriptionByEmail(email);
    if (!result.active) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const { status, message } = getStripeRouteErrorInfo(err);
    return NextResponse.json({ active: false, error: message }, { status });
  }
}
