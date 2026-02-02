"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/Header";

type PlanCode = "FREE" | "BASIC" | "ADVANCED" | "PRO";
type Plan = {
  id: string;
  code: PlanCode;
  name: string;
  priceMonthly: number;
  stripePriceId: string | null;
};

type PlansApiResponse = { ok: true; plans: Plan[] } | { error: string };

type MeApiResponse =
  | { ok: true; user: { emailVerified?: boolean } }
  | { error: string };

const FEATURES: Record<PlanCode, string[]> = {
  FREE: ["Basic assistants", "Limited usage", "Community support"],
  BASIC: ["Secure assistants", "Basic onboarding", "Email support"],
  ADVANCED: [
    "Everything in Basic",
    "Company data training",
    "Priority support",
  ],
  PRO: ["Everything in Advanced", "Custom integrations", "SLA support"],
};

/* ✅ INR formatter (SAFE CHANGE) */
function formatInrMonthly(amount: number) {
  if (amount === 0) return "Free";
  return `₹${amount.toLocaleString("en-IN")}/mo`;
}

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activatingFree, setActivatingFree] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const sortedPlans = useMemo(() => {
    if (!plans) return null;
    return [...plans].sort((a, b) => a.priceMonthly - b.priceMonthly);
  }, [plans]);

  /* Load plans */
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

  /* Load auth state */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as MeApiResponse;
        if (!cancelled && "ok" in data && data.ok) {
          setIsLoggedIn(true);
          setEmailVerified(data.user.emailVerified ?? false);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onResendVerification() {
    setResendingVerification(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setCheckoutError(data.error ?? "Failed to resend verification email");
      } else {
        setCheckoutError(null);
        alert("Verification email sent! Please check your inbox.");
      }
    } catch {
      setCheckoutError("Network error. Please try again.");
    } finally {
      setResendingVerification(false);
    }
  }

  async function onBuyClick(plan: Plan) {
    setCheckoutError(null);

    /* FREE PLAN */
    if (plan.code === "FREE") {
      if (!isLoggedIn) {
        router.push(`/register?redirect=${encodeURIComponent("/pricing")}`);
        return;
      }

      setActivatingFree(true);
      try {
        const res = await fetch("/api/plans/activate-free", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          setCheckoutError(data.error ?? "Failed to activate free plan");
          return;
        }
        window.location.reload();
      } catch {
        setCheckoutError("Network error. Please try again.");
      } finally {
        setActivatingFree(false);
      }
      return;
    }

    /* PAID PLANS */
    if (!isLoggedIn) {
      router.push(`/login?redirect=${encodeURIComponent("/pricing")}`);
      return;
    }

    if (!emailVerified) {
      setCheckoutError(
        "Please verify your email address before purchasing a plan. Check your inbox for the verification link."
      );
      return;
    }

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
        <Header />

        <section className="mt-12 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Pricing
          </h1>
          <p className="max-w-2xl text-zinc-600">
            Pick a plan to start deploying AI assistants for your business.
          </p>
        </section>

        <section className="mt-10">
          {isLoggedIn && !emailVerified && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-medium text-amber-900">
                Email Verification Required
              </div>
              <div className="mt-1 text-sm text-amber-800">
                Please verify your email address to purchase a paid plan, or{" "}
                <button
                  onClick={onResendVerification}
                  disabled={resendingVerification}
                  className="underline font-medium"
                >
                  {resendingVerification ? "Sending..." : "resend verification email"}
                </button>
                .
              </div>
            </div>
          )}

          {checkoutError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-medium text-red-800">
                Checkout error
              </div>
              <div className="mt-1 text-sm text-red-700">{checkoutError}</div>
            </div>
          )}

          {!sortedPlans || sortedPlans.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="text-sm font-medium text-zinc-900">
                No plans available
              </div>
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
                        {formatInrMonthly(plan.priceMonthly)}
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
                      isLoading={
                        plan.code === "FREE"
                          ? activatingFree
                          : checkoutPlanId === plan.id
                      }
                    >
                      {plan.code === "FREE"
                        ? isLoggedIn
                          ? "Start Now"
                          : "Get Started"
                        : isLoggedIn
                        ? emailVerified
                          ? "Buy Now"
                          : "Verify Email First"
                        : "Sign in to buy"}
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
