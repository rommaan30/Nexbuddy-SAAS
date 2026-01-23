export type AuthCredentialsDto = {
  name: string;
  email: string;
  password: string;
};

type UnknownRecord = Record<string, unknown>;

export function parseAuthCredentials(body: unknown): AuthCredentialsDto | null {
  if (!body || typeof body !== "object") return null;
  const record = body as UnknownRecord;
  const name = record.name;
  const email = record.email;
  const password = record.password;
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") return null;

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password;

  if (normalizedName.length < 1 || normalizedName.length > 100) return null;
  if (normalizedEmail.length < 3 || normalizedEmail.length > 254) return null;
  if (!normalizedEmail.includes("@")) return null;
  if (normalizedPassword.length < 8 || normalizedPassword.length > 128) return null;

  return { name: normalizedName, email: normalizedEmail, password: normalizedPassword };
}


