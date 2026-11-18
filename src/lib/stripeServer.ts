export type PublicCheckoutTier = "5usd" | "3usd";

interface StripeSubscriptionObject {
  id: string;
  status?: string;
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
      };
    }>;
  };
}

export interface StripeCheckoutSessionObject {
  id: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  customer_email?: string | null;
  customer_details?: {
    email?: string | null;
  } | null;
  metadata?: Record<string, string>;
  subscription?: string | StripeSubscriptionObject | null;
}

interface StripeCustomerObject {
  id: string;
  email?: string | null;
}

interface StripeListResponse<T> {
  data: T[];
}

interface StripeErrorPayload {
  error?: {
    message?: string;
  };
}

export interface VerifySessionResult {
  verified: boolean;
  planTier?: "creator";
  customerEmail?: string;
  subscriptionId?: string;
  error?: string;
}

export interface RestoreSubscriptionResult {
  active: boolean;
  planTier?: "creator";
  customerEmail?: string;
  subscriptionId?: string;
  error?: string;
}

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export function getStripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

export function getStripePriceId(tier: PublicCheckoutTier): string {
  return tier === "3usd"
    ? process.env.STRIPE_PRICE_ID_3USD?.trim() || ""
    : process.env.STRIPE_PRICE_ID_5USD?.trim() || "";
}

export function getStripeRouteErrorInfo(err: unknown): {
  status: number;
  message: string;
} {
  const raw = err instanceof Error ? err.message : "";
  if (raw === "MISSING_STRIPE_SECRET_KEY") {
    return {
      status: 503,
      message:
        "La pasarela de pago aún está terminando su activación en el servidor.",
    };
  }
  return {
    status: 500,
    message: raw || "No se pudo comunicar con Stripe en este momento.",
  };
}

export function isValidStripeSessionId(sessionId: string): boolean {
  return /^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(sessionId.trim());
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getConfiguredCreatorPriceIds(): Set<string> {
  const ids = [getStripePriceId("5usd"), getStripePriceId("3usd")].filter(Boolean);
  return new Set(ids);
}

/**
 * Validates that a Stripe Checkout Session belongs to FreeClips and is paid/active.
 */
export function isCreatorSessionPaid(
  session: StripeCheckoutSessionObject
): boolean {
  if (session.status !== "complete") {
    return false;
  }

  const sub =
    typeof session.subscription === "object" && session.subscription !== null
      ? session.subscription
      : null;

  const subActive =
    sub?.status === "active" || sub?.status === "trialing";
  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required" ||
    subActive;

  if (!paid) {
    return false;
  }

  const sessionApp = session.metadata?.app || sub?.metadata?.app;
  if (sessionApp && sessionApp !== "freeclips") {
    return false;
  }

  return true;
}

function isCreatorSubscriptionActive(
  sub: StripeSubscriptionObject,
  allowedPriceIds: Set<string>
): boolean {
  if (sub.status !== "active" && sub.status !== "trialing") {
    return false;
  }
  if (sub.metadata?.app === "freeclips") {
    return true;
  }
  if (allowedPriceIds.size === 0) {
    return false;
  }
  const items = sub.items?.data ?? [];
  return items.some(
    (item) => item.price?.id && allowedPriceIds.has(item.price.id)
  );
}

async function stripeApiRequest<T>(
  path: string,
  options: {
    method: "GET" | "POST";
    formParams?: URLSearchParams;
  }
): Promise<T> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error("MISSING_STRIPE_SECRET_KEY");
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${secretKey}`,
  };
  let body: string | undefined;
  if (options.method === "POST" && options.formParams) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = options.formParams.toString();
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: options.method,
    headers,
    body,
    cache: "no-store",
  });

  const payload = (await response.json()) as T & StripeErrorPayload;
  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `Stripe API respondió con código ${response.status}.`
    );
  }

  return payload;
}

export async function createStripeCheckoutSession(params: {
  tier: PublicCheckoutTier;
  origin: string;
  customerEmail?: string;
}): Promise<{ url: string; sessionId: string }> {
  const priceId = getStripePriceId(params.tier);
  if (!priceId) {
    throw new Error(
      `Falta el precio configurado en el servidor (${params.tier}).`
    );
  }

  const cleanOrigin = params.origin.replace(/\/+$/, "");
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set(
    "success_url",
    `${cleanOrigin}/?checkout_session_id={CHECKOUT_SESSION_ID}`
  );
  form.set("cancel_url", `${cleanOrigin}/?checkout_canceled=1`);
  form.set("billing_address_collection", "auto");
  form.set("metadata[app]", "freeclips");
  form.set("metadata[plan_tier]", "creator");
  form.set("metadata[billing_tier]", params.tier);
  form.set("subscription_data[metadata][app]", "freeclips");
  form.set("subscription_data[metadata][plan_tier]", "creator");
  form.set("subscription_data[metadata][billing_tier]", params.tier);

  if (params.customerEmail && isValidEmail(params.customerEmail)) {
    form.set("customer_email", params.customerEmail.trim());
  }

  const session = await stripeApiRequest<StripeCheckoutSessionObject>(
    "/checkout/sessions",
    {
      method: "POST",
      formParams: form,
    }
  );

  if (!session.url) {
    throw new Error("Stripe no devolvió una URL de checkout válida.");
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}

export async function verifyStripeCheckoutSession(
  sessionId: string
): Promise<VerifySessionResult> {
  const trimmed = sessionId.trim();
  if (!isValidStripeSessionId(trimmed)) {
    return {
      verified: false,
      error: "Identificador de sesión de pago inválido.",
    };
  }

  const session = await stripeApiRequest<StripeCheckoutSessionObject>(
    `/checkout/sessions/${encodeURIComponent(trimmed)}?expand[]=subscription`,
    { method: "GET" }
  );

  if (!isCreatorSessionPaid(session)) {
    return {
      verified: false,
      error: "El pago aún no aparece confirmado como completado en Stripe.",
    };
  }

  const customerEmail =
    session.customer_details?.email || session.customer_email || undefined;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  return {
    verified: true,
    planTier: "creator",
    customerEmail,
    subscriptionId,
  };
}

export async function restoreCreatorSubscriptionByEmail(
  email: string
): Promise<RestoreSubscriptionResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return {
      active: false,
      error: "Ingresa un correo electrónico válido para verificar tu suscripción.",
    };
  }

  const customers = await stripeApiRequest<
    StripeListResponse<StripeCustomerObject>
  >(`/customers?email=${encodeURIComponent(normalizedEmail)}&limit=5`, {
    method: "GET",
  });

  if (!customers.data || customers.data.length === 0) {
    return {
      active: false,
      error: "No encontramos una suscripción activa con ese correo en Stripe.",
    };
  }

  const allowedPriceIds = getConfiguredCreatorPriceIds();

  for (const customer of customers.data) {
    const subs = await stripeApiRequest<
      StripeListResponse<StripeSubscriptionObject>
    >(
      `/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=10`,
      { method: "GET" }
    );
    const activeMatch = subs.data.find((sub) =>
      isCreatorSubscriptionActive(sub, allowedPriceIds)
    );
    if (activeMatch) {
      return {
        active: true,
        planTier: "creator",
        customerEmail: customer.email || normalizedEmail,
        subscriptionId: activeMatch.id,
      };
    }
  }

  return {
    active: false,
    error: "No encontramos una suscripción activa de FreeClips para ese correo.",
  };
}
