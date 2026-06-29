import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Loader2, Sparkles, Zap, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createCheckout, openCustomerPortal } from "@/lib/stripe.functions";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/subscription")({
  head: () => ({
    meta: [
      { title: "Pricing — SolverHunt" },
      {
        name: "description",
        content:
          "Choose a SolverHunt plan: Free, Starter, Pro, or Agency. Lead discovery with monthly search quotas.",
      },
      { property: "og:title", content: "SolverHunt Pricing" },
      {
        property: "og:description",
        content: "Free, Starter, Pro and Agency plans with monthly search quotas, no-website filter, smart tools, and lead scoring.",
      },
    ],
  }),
  component: SubscriptionPage,
});

type Plan = {
  id: "free" | "starter" | "pro" | "agency";
  name: string;
  price: number;
  searches: number;
  searchesLabel?: string;
  tagline: string;
  features: string[];
  recommended?: boolean;
  highlight?: string;
  cta?: string;
  isFree?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    searches: 5,
    searchesLabel: "5 credits / month",
    tagline: "Try SolverHunt risk-free — no credit card required.",
    cta: "Current plan",
    isFree: true,
    features: [
      "5 lead search credits / month",
      "Core business info (phone, address, rating)",
      "Save leads to one list",
      "CSV export (basic)",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 29,
    searches: 100,
    tagline: "For freelancers just getting started with cold outreach.",
    features: [
      "100 lead searches / month",
      "“No website” filter",
      "Save leads to lists",
      "CSV export",
      "Core business info (phone, address, rating)",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    searches: 500,
    tagline: "For solo founders and small teams closing real deals.",
    recommended: true,
    highlight: "Most popular",
    features: [
      "500 lead searches / month",
      "“All categories” fan-out search",
      "Smart website generation for any lead",
      "Save leads to unlimited lists",
      "CSV export",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: 199,
    searches: 2000,
    tagline: "For agencies running full lead-gen campaigns at scale.",
    features: [
      "2,000 lead searches / month",
      "Everything in Pro",
      "Smart Lead Score (lead quality rating)",
      "Priority generation queue",
      "Bulk export + advanced filters",
    ],
  },
];

function SubscriptionPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0f1c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,0.18) 0%, rgba(10,15,28,0) 70%), radial-gradient(40% 40% at 80% 30%, rgba(59,130,246,0.18) 0%, rgba(10,15,28,0) 70%), radial-gradient(40% 40% at 15% 60%, rgba(168,85,247,0.12) 0%, rgba(10,15,28,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>

        <div className="mx-auto mt-10 max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Plans &amp; pricing
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Find more leads,
            <span
              className="block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #34d399 0%, #22d3ee 50%, #60a5fa 100%)",
              }}
            >
              close more deals
            </span>
          </h1>
          <p className="mt-4 text-base text-slate-400">
            Every plan is built on the same core engine. Pick the search volume that fits your pipeline.
          </p>
          <p className="mt-2 text-xs text-slate-500">Free plan: 5 credits / month — to try it out.</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          Cancel anytime. Prices in USD. Taxes may apply depending on your region.
        </p>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const isPro = !!plan.recommended;
  const isFree = !!plan.isFree;
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckout);
  const portal = useServerFn(openCustomerPortal);
  const [loading, setLoading] = useState<null | "checkout" | "portal">(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const handleCheckout = async () => {
    if (isFree) return;
    if (!userEmail) {
      toast.error("Please sign in first to subscribe.");
      navigate({ to: "/auth" });
      return;
    }
    setLoading("checkout");
    try {
      const { url } = await checkout({ data: { plan: plan.id as "starter" | "pro" | "agency", email: userEmail } });
      if (url) window.location.href = url;
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  };


  const handlePortal = async () => {
    if (!userEmail) {
      toast.error("Please sign in first.");
      navigate({ to: "/auth" });
      return;
    }
    setLoading("portal");
    try {
      const { url } = await portal({ data: { email: userEmail } });
      if (url) window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open portal");
    } finally {
      setLoading(null);
    }
  };


  return (
    <div className="relative">
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <div
            className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, rgb(16,185,129) 0%, rgb(59,130,246) 100%)",
            }}
          >
            Recommended
          </div>
        </div>
      )}

      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-7 backdrop-blur-xl transition-all ${
          isPro
            ? "border-emerald-400/30 bg-white/[0.04] shadow-[0_30px_80px_-30px_rgba(16,185,129,0.45)]"
            : isFree
            ? "border-white/10 bg-white/[0.015] hover:border-white/20"
            : "border-white/10 bg-white/[0.02] hover:border-white/20"
        }`}
      >
        {isPro && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 0%, rgba(16,185,129,0.15) 0%, transparent 70%)",
            }}
          />
        )}

        <div className="relative">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              {isFree && <Gift className="h-4 w-4 text-emerald-300" />}
              {plan.name}
            </h3>
            {plan.highlight && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-300">
                {plan.highlight}
              </span>
            )}
            {isFree && (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                Forever free
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-400">{plan.tagline}</p>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-5xl font-semibold tracking-tight">${plan.price}</span>
            <span className="text-sm text-slate-400">/month</span>
          </div>
          <p className="mt-1 text-xs font-medium text-emerald-300">
            {plan.searchesLabel ?? `${plan.searches.toLocaleString()} searches / month`}
          </p>

          {isFree ? (
            <div className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
              <Gift className="h-4 w-4" />
              Included for everyone
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading !== null}
              className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-60 ${
                isPro
                  ? "text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.7)] hover:brightness-110"
                  : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
              style={
                isPro
                  ? {
                      background:
                        "linear-gradient(135deg, rgb(16,185,129) 0%, rgb(20,184,166) 50%, rgb(59,130,246) 100%)",
                    }
                  : undefined
              }
            >
              {loading === "checkout" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPro ? (
                <Zap className="h-4 w-4" />
              ) : null}
              {loading === "checkout" ? "Redirecting…" : `Choose ${plan.name}`}
            </button>
          )}

          {!isFree && (
            <button
              type="button"
              onClick={handlePortal}
              disabled={loading !== null}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-slate-400 transition hover:text-white disabled:opacity-60"
            >
              {loading === "portal" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Manage existing subscription
            </button>
          )}

          <div className="mt-5 h-px w-full bg-white/10" />

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Plan highlights
          </p>
          <ul className="mt-3 space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-slate-200">
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    isPro
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-white/10 text-slate-200"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
