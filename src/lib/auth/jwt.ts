import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN } from "./constants";

export type JwtUserPayload = {
  userId: string;
  email: string;
};

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET env var");
  return secret;
}

export function signToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtUserPayload {
  const decoded = jwt.verify(token, requireJwtSecret());
  if (
    !decoded ||
    typeof decoded !== "object" ||
    !("userId" in decoded) ||
    !("email" in decoded) ||
    typeof (decoded as Record<string, unknown>).userId !== "string" ||
    typeof (decoded as Record<string, unknown>).email !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtUserPayload;
}


