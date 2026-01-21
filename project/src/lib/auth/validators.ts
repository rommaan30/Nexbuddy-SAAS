export type AuthCredentialsDto = {
  email: string;
  password: string;
};

type UnknownRecord = Record<string, unknown>;

export function parseAuthCredentials(body: unknown): AuthCredentialsDto | null {
  if (!body || typeof body !== "object") return null;
  const record = body as UnknownRecord;
  const email = record.email;
  const password = record.password;
  if (typeof email !== "string" || typeof password !== "string") return null;

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password;

  if (normalizedEmail.length < 3 || normalizedEmail.length > 254) return null;
  if (!normalizedEmail.includes("@")) return null;
  if (normalizedPassword.length < 8 || normalizedPassword.length > 128) return null;

  return { email: normalizedEmail, password: normalizedPassword };
}


