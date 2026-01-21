"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type PlanCode = "BASIC" | "ADVANCED" | "PRO";
type Plan = {
  id: string;
  code: PlanCode;
  name: string;
  priceMonthly: number;
  stripePriceId: string;
};

type PlansApiResponse = { ok: true; plans: Plan[] } | { error: string };

type MeApiResponse = { ok: true; user: unknown } | { error: string };

const FEATURES: Record<PlanCode, string[]> = {
  BASIC: ["Secure assistants", "Basic onboarding", "Email support"],
  ADVANCED: [
    "Everything in Basic",
    "Company data training",
    "Priority support",
  ],
  PRO: ["Everything in Advanced", "Custom integrations", "SLA support"],
};

function formatUsdMonthly(centsOrDollars: number) {
  // priceMonthly is stored as Int. We treat it as USD dollars for now.
  return `$${centsOrDollars}/mo`;
}

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const sortedPlans = useMemo(() => {
    if (!plans) return null;
    return [...plans].sort((a, b) => a.priceMonthly - b.priceMonthly);
  }, [plans]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoadingPlans(true);
      setPlansError(null);
      try {
        const res = await fetch("/api/plans", { cache: "no-store" });
        const data = (await res.json()) as PlansApiResponse;
        if (!res.ok) throw new Error("error" in data ? data.error : "Error");
        if (!("ok" in data) || !data.ok)
          throw new Error("Failed to load plans");
        if (!cancelled) setPlans(data.plans);
      } catch (e) {
        if (!cancelled)
          setPlansError(
            e instanceof Error ? e.message : "Failed to load plans"
          );
      } finally {
        if (!cancelled) setIsLoadingPlans(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as MeApiResponse;
        if (!cancelled && "ok" in data && data.ok) setIsLoggedIn(true);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onBuyClick(plan: Plan) {
    setCheckoutError(null);
    if (!isLoggedIn) {
      router.push(`/login?redirect=${encodeURIComponent("/pricing")}`);
      return;
    }

    console.log("Checkout planCode:", plan.code);
    setCheckoutPlanId(plan.id);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode: plan.code }),
      });
      const data = (await res.json()) as { url?: string } | { error: string };
      if (!res.ok) {
        setCheckoutError("error" in data ? data.error : "Checkout failed");
        return;
      }
      if (!("url" in data) || typeof data.url !== "string") {
        setCheckoutError("Checkout failed");
        return;
      }
      window.location.href = data.url;
    } catch {
      setCheckoutError("Network error. Please try again.");
    } finally {
      setCheckoutPlanId(null);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <header className="flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-900">
            <Link href="/">NexBuddy</Link>
          </div>
          <div className="text-sm text-zinc-600">
            {isLoggedIn ? (
              "You’re signed in"
            ) : (
              <Link href="/login?redirect=%2Fpricing" className="underline">
                Sign in
              </Link>
            )}
          </div>
        </header>

        <section className="mt-12 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Pricing
          </h1>
          <p className="max-w-2xl text-zinc-600">
            Pick a plan to start deploying AI assistants for your business.
          </p>
        </section>

        <section className="mt-10">
          {checkoutError ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-medium text-red-800">
                Checkout error
              </div>
              <div className="mt-1 text-sm text-red-700">{checkoutError}</div>
            </div>
          ) : null}
          {isLoadingPlans ? (
            <div className="grid gap-6 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[340px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-50"
                />
              ))}
            </div>
          ) : plansError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-medium text-red-800">
                Failed to load plans
              </div>
              <div className="mt-1 text-sm text-red-700">{plansError}</div>
              <button
                className="mt-3 text-sm font-medium text-red-800 underline"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          ) : !sortedPlans || sortedPlans.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="text-sm font-medium text-zinc-900">
                No plans available
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                Add plans in the database and refresh this page.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {sortedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {plan.name}
                      </div>
                      <div className="mt-2 text-3xl font-semibold text-zinc-900">
                        {formatUsdMonthly(plan.priceMonthly)}
                      </div>
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                      {plan.code}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-2 text-sm text-zinc-700">
                    {FEATURES[plan.code].map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-900/60" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <Button
                      onClick={() => onBuyClick(plan)}
                      isLoading={checkoutPlanId === plan.id}
                    >
                      {isLoggedIn ? "Buy" : "Sign in to buy"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
