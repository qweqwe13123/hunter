import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Stripe Product IDs. Create three products in your Stripe dashboard at the
// SolverHunt prices ($29 / $79 / $199 monthly recurring) and paste the IDs here.
// Existing legacy IDs are kept as fallback for the old $29/$49 catalog so
// in-flight checkouts don't break — replace them when the new products exist.
export const PRODUCT_IDS = {
  starter: process.env.STRIPE_PRODUCT_STARTER || "prod_UlMvutC1kcUln8", // $29
  pro:     process.env.STRIPE_PRODUCT_PRO     || "prod_UlMvutC1kcUln8", // $79 (replace!)
  agency:  process.env.STRIPE_PRODUCT_AGENCY  || "prod_UlMvMsulSFqCk3", // $199 (replace!)
} as const;

export type PlanId = keyof typeof PRODUCT_IDS;

const priceCache = new Map<string, string>();

async function resolvePriceId(
  stripe: import("stripe").default,
  productId: string,
): Promise<string> {
  const cached = priceCache.get(productId);
  if (cached) return cached;
  const product = await stripe.products.retrieve(productId);
  let priceId: string | null = null;
  const dp = product.default_price;
  if (typeof dp === "string") priceId = dp;
  else if (dp && typeof dp === "object" && "id" in dp) priceId = (dp as { id: string }).id;
  if (!priceId) {
    const prices = await stripe.prices.list({ product: productId, active: true, limit: 1 });
    priceId = prices.data[0]?.id ?? null;
  }
  if (!priceId) throw new Error(`No active price found for product ${productId}`);
  priceCache.set(productId, priceId);
  return priceId;
}

function getOrigin(): string {
  return (
    getRequestHeader("origin") ||
    getRequestHeader("referer")?.replace(/\/$/, "") ||
    "http://localhost:8080"
  );
}

async function getStripe() {
  const key = process.env.STRIPE_TEST_API_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as never });
}

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: { plan: PlanId; email?: string }) => {
    if (!input || !(input.plan in PRODUCT_IDS)) {
      throw new Error("Invalid plan");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const stripe = await getStripe();
    const origin = getOrigin();

    const priceId = await resolvePriceId(stripe, PRODUCT_IDS[data.plan]);

    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS ?? "7");

    const session = await stripe.checkout.sessions.create({
      customer_email: data.email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      subscription_data: trialDays > 0 ? { trial_period_days: trialDays } : undefined,
      success_url: `${origin}/subscription?success=1`,
      cancel_url: `${origin}/subscription?canceled=1`,
      metadata: { plan: data.plan },
    });

    return { url: session.url };
  });


export const checkSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stripe = await getStripe();
    const email = (context.claims as { email?: string } | undefined)?.email;
    const syncPlan = async (plan: "free" | PlanId) => {
      // Best-effort sync of user_usage.plan; ignore failures.
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("user_usage")
          .upsert({ user_id: context.userId, plan }, { onConflict: "user_id" });
      } catch {
        /* noop */
      }
    };

    if (!email) {
      await syncPlan("free");
      return { subscribed: false as const, plan: null, periodEnd: null };
    }

    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) {
      await syncPlan("free");
      return { subscribed: false as const, plan: null, periodEnd: null };
    }

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });
    const sub = subs.data[0];
    if (!sub) {
      await syncPlan("free");
      return { subscribed: false as const, plan: null, periodEnd: null };
    }

    const productId = (sub.items.data[0]?.price.product as string) ?? null;
    let plan: PlanId | null = null;
    if (productId === PRODUCT_IDS.agency) plan = "agency";
    else if (productId === PRODUCT_IDS.pro) plan = "pro";
    else if (productId === PRODUCT_IDS.starter) plan = "starter";

    await syncPlan(plan ?? "free");

    return {
      subscribed: true as const,
      plan,
      periodEnd: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
    };
  });

export const openCustomerPortal = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    if (!input?.email) throw new Error("Email required");
    return input;
  })
  .handler(async ({ data }) => {
    const stripe = await getStripe();
    const origin = getOrigin();

    const customers = await stripe.customers.list({ email: data.email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) throw new Error("No Stripe customer found for that email");

    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/subscription`,
    });
    return { url: portal.url };
  });

