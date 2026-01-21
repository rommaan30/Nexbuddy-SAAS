import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <main className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Payment cancelled
          </h1>
          <p className="mt-2 text-zinc-600">
            No worries — you can try again anytime.
          </p>

          <div className="mt-6">
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Back to pricing
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}


