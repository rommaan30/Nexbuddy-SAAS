import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAuthCookie } from "@/lib/auth/cookies";
import { signToken } from "@/lib/auth/jwt";
import { parseAuthCredentials } from "@/lib/auth/validators";
import { badRequest, internalError } from "@/lib/http/errors";

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

  const creds = parseAuthCredentials(body);
  if (!creds) return badRequest("Invalid email or password");

  try {
    // Check for existing user to prevent duplicate registration
    const existing = await prisma.user.findUnique({
      where: { email: creds.email },
      select: { id: true },
    });
    if (existing) return badRequest("User already exists");

    // Hash password with bcrypt (12 rounds for security)
    const passwordHash = await bcrypt.hash(creds.password, 12);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email: creds.email,
        passwordHash,
      },
      select: { id: true, email: true, createdAt: true },
    });

    // Generate JWT token
    const token = signToken({ userId: user.id, email: user.email });

    // Return success response with auth cookie
    return new Response(JSON.stringify({ ok: true, user }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": buildAuthCookie(token),
      },
    });
  } catch (error) {
    // Handle Prisma unique constraint violation (race condition)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return badRequest("User already exists");
    }
    
    // Handle Prisma connection errors
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientKnownRequestError
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
      console.error("Register error:", error);
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
    
    // Avoid leaking internal details; keep errors generic for production
    return internalError();
  }
}


