import { NextRequest, NextResponse } from "next/server";
import { readAuthTokenFromCookieHeader } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";

/**
 * Non-blocking auth middleware.
 * - If a valid JWT cookie exists, attach `x-user-id` to downstream requests.
 * - Does NOT enforce auth (no redirects / no 401s).
 */
export function middleware(req: NextRequest) {
  const token = readAuthTokenFromCookieHeader(req.headers.get("cookie"));
  if (!token) return NextResponse.next();

  try {
    const payload = verifyToken(token);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", payload.userId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Invalid/expired token: just pass through without user headers.
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/api/:path*"],
};


