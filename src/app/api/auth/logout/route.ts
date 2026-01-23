import { buildClearAuthCookie } from "@/lib/auth/cookies";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": buildClearAuthCookie(),
    },
  });
}
