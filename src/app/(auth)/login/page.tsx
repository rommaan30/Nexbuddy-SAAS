"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ApiOk<T> = { ok: true } & T;
type ApiErr = { error: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [redirectTo, setRedirectTo] = useState("/pricing");

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("redirect");
    if (!raw) return;
    if (!raw.startsWith("/")) return;
    if (raw.startsWith("//")) return;
    if (raw.includes("://")) return;
    setRedirectTo(raw);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as ApiOk<{ user: unknown }> | ApiErr;
        if (!cancelled && "ok" in data && data.ok) router.replace(redirectTo);
      } finally {
        if (!cancelled) setIsCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, redirectTo]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as ApiOk<{ user: unknown }> | ApiErr;
      if (!res.ok) {
        setError("error" in data ? data.error : "Login failed");
        return;
      }
      router.replace(redirectTo);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-12">
        <div className="w-full rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-600">Checking session…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-12">
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
          <p className="text-sm text-zinc-600">Welcome back to NexBuddy.</p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            placeholder="you@company.com"
          />
          <div className="space-y-1">
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              placeholder="Your password"
            />
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-zinc-600 hover:text-zinc-900 underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" isLoading={isSubmitting}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          New to NexBuddy?{" "}
          <Link
            href="/register"
            className="font-medium text-zinc-900 underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
