import { serialize, parse } from "cookie";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "./constants";

export function buildAuthCookie(token: string): string {
  return serialize(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function buildClearAuthCookie(): string {
  return serialize(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function readAuthTokenFromCookieHeader(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  return cookies[AUTH_COOKIE_NAME] ?? null;
}


