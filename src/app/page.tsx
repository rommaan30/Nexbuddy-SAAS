import Link from "next/link";
import { Header } from "@/components/Header";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <Header />

        <section className="mt-16 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
              Deploy in minutes • Subscription billing
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              NexBuddy
            </h1>
            <p className="text-lg text-zinc-600">
              Deploy AI assistants for your business in minutes
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
              >
                View Plans
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Register
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-semibold text-zinc-900">
                  Secure AI assistants
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  Auth-first onboarding with a production-grade foundation.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-semibold text-zinc-900">
                  Company data training
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  Ready for RAG later — without schema rework.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2">
                <div className="text-sm font-semibold text-zinc-900">
                  Easy website integration
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  Designed to evolve into embeddable widgets when you’re ready.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
