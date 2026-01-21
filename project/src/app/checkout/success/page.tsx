export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Payment successful
          </h1>
          <p className="mt-2 text-zinc-600">Setting up your account...</p>
          {sessionId ? (
            <p className="mt-6 text-sm text-zinc-500">
              Session: <span className="font-mono">{sessionId}</span>
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}


