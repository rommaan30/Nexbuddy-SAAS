import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAuthCookie } from "@/lib/auth/cookies";
import { signToken } from "@/lib/auth/jwt";
import { parseLoginCredentials } from "@/lib/auth/validators";
import { badRequest, internalError, unauthorized } from "@/lib/http/errors";

export async function POST(req: Request) {
  // Validate required environment variables early
  if (!process.env.JWT_SECRET) {
    const errorMsg = process.env.NODE_ENV === "development" 
      ? "Server configuration error: Missing JWT_SECRET environment variable"
      : "Server configuration error";
    return Response.json({ error: errorMsg }, { status: 500 });
  }

  if (!process.env.DATABASE_URL) {
    const errorMsg = process.env.NODE_ENV === "development" 
      ? "Server configuration error: Missing DATABASE_URL environment variable. Please create a .env.local file with your database connection string."
      : "Server configuration error: Database connection failed";
    return Response.json({ error: errorMsg }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const creds = parseLoginCredentials(body);
  if (!creds) return badRequest("Invalid email or password");

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: creds.email },
      select: { id: true, name: true, email: true, passwordHash: true, createdAt: true },
    });

    // Return generic error to prevent email enumeration
    if (!user) return unauthorized("Invalid credentials");

    // Verify password hash
    const passwordMatch = await bcrypt.compare(creds.password, user.passwordHash);
    if (!passwordMatch) return unauthorized("Invalid credentials");

    // Generate JWT token
    const token = signToken({ userId: user.id, email: user.email });

    // Return success response with auth cookie
    return new Response(
      JSON.stringify({
        ok: true,
        user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": buildAuthCookie(token),
        },
      },
    );
  } catch (error) {
    // Handle Prisma connection errors
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && 
       error.code.startsWith("P1"))
    ) {
      const isDev = process.env.NODE_ENV === "development";
      if (isDev) {
        console.error("Database error:", error);
        return Response.json(
          { 
            error: `Database connection failed: ${error.message}. Please check your DATABASE_URL in .env.local` 
          },
          { status: 500 }
        );
      }
      return Response.json(
        { error: "Server configuration error: Database connection failed" },
        { status: 500 }
      );
    }
    
    // Log error details in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.error("Login error:", error);
      // Check for common issues
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes("jwt_secret")) {
          return Response.json(
            { error: "Server configuration error: Missing JWT_SECRET" },
            { status: 500 }
          );
        }
        if (
          errorMsg.includes("database") || 
          errorMsg.includes("connection") ||
          errorMsg.includes("can't reach") ||
          errorMsg.includes("connect econnrefused") ||
          errorMsg.includes("authentication failed")
        ) {
          return Response.json(
            { 
              error: `Database connection failed: ${error.message}. Please verify your DATABASE_URL in .env.local` 
            },
            { status: 500 }
          );
        }
        return Response.json(
          { error: `Server error: ${error.message}` },
          { status: 500 }
        );
      }
    }
    return internalError();
  }
}


