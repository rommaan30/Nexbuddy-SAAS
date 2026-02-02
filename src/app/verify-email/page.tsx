"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";

type VerificationResponse =
  | { ok: true; message: string }
  | { error: string };

export default function VerifyEmailPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [status, setStatus] = useState<
    "loading" | "success" | "error" | "idle"
  >("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    // Get token from URL query params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    setToken(tokenParam);

    if (!tokenParam) {
      setStatus("error");
      setMessage("Verification token is missing");
      return;
    }

    // Verify email on mount
    (async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/auth/verify-email?token=${tokenParam}`);
        const data = (await res.json()) as VerificationResponse;

        if (!res.ok) {
          setStatus("error");
          setMessage("error" in data ? data.error : "Verification failed");
          return;
        }

        setStatus("success");
        setMessage("ok" in data ? data.message : "Email verified successfully");

        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } catch {
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    })();
  }, [router]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <Header />

        <section className="mt-16 max-w-md mx-auto">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Verify Email Address
            </h1>

            {status === "loading" && (
              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                  <p className="text-sm text-zinc-600">Verifying your email...</p>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="mt-6">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600">
                      <svg
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">
                        Email verified successfully!
                      </p>
                      <p className="mt-1 text-sm text-green-800">
                        {message}
                      </p>
                      <p className="mt-2 text-sm text-green-700">
                        Redirecting to login...
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="mt-6">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600">
                      <svg
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">
                        Verification failed
                      </p>
                      <p className="mt-1 text-sm text-red-800">{message}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Link
                    href="/login"
                    className="block w-full text-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Go to Login
                  </Link>
                  <Link
                    href="/register"
                    className="block w-full text-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            )}

            {status === "idle" && !token && (
              <div className="mt-6">
                <p className="text-sm text-zinc-600">
                  No verification token provided.
                </p>
                <div className="mt-4">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-zinc-900 underline"
                  >
                    Go to Login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
