export type CheckoutTier = "5usd" | "3usd" | "10usd_agency";

export interface StripeCheckoutResolution {
  configured: boolean;
  url: string | null;
  envVarName: string;
}

/**
 * Resolves Stripe Checkout / Mercado Pago link URLs from NEXT_PUBLIC_* environment variables.
 */
export function resolveStripeCheckoutLink(
  tier: CheckoutTier,
  prefillEmail?: string
): StripeCheckoutResolution {
  const envVarName =
    tier === "3usd"
      ? "NEXT_PUBLIC_STRIPE_CHECKOUT_URL_3USD"
      : tier === "10usd_agency"
        ? "NEXT_PUBLIC_STRIPE_CHECKOUT_URL_AGENCY_10USD"
        : "NEXT_PUBLIC_STRIPE_CHECKOUT_URL_5USD";

  const rawUrl =
    tier === "3usd"
      ? process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_3USD?.trim()
      : tier === "10usd_agency"
        ? process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_AGENCY_10USD?.trim()
        : process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_5USD?.trim();

  if (!rawUrl) {
    return {
      configured: false,
      url: null,
      envVarName,
    };
  }

  try {
    const parsed = new URL(rawUrl);
    if (prefillEmail && !parsed.searchParams.has("prefilled_email")) {
      parsed.searchParams.set("prefilled_email", prefillEmail);
    }
    return {
      configured: true,
      url: parsed.toString(),
      envVarName,
    };
  } catch {
    return {
      configured: false,
      url: null,
      envVarName,
    };
  }
}
