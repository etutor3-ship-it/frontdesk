import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting: in-memory store (resets on server restart)
// For production, use Redis or a distributed store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number } {
  const key = `${ip}:${path}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

function addSecureHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
  );
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

const STAFF_PATH_PREFIX = "/staff";
const TICKET_API_PATH = "/api/tickets";
const LOGIN_PATH = "/login";
const AUTH_API_PREFIX = "/api/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Rate limiting on all API routes
  if (pathname.startsWith("/api/")) {
    const { allowed } = checkRateLimit(ip, pathname);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // Add secure headers to all responses
  const response = NextResponse.next();
  addSecureHeaders(response);

  // Allow login page and auth APIs without session
  if (pathname === LOGIN_PATH || pathname.startsWith(AUTH_API_PREFIX)) {
    return response;
  }

  // Protect staff page - check for session cookie
  if (pathname === STAFF_PATH_PREFIX || pathname.startsWith(STAFF_PATH_PREFIX + "/")) {
    const sessionCookie = request.cookies.get("session_id");
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }
    // Session validity is verified client-side on the staff page
    return response;
  }

  // Protect ticket API - check for session cookie
  if (pathname === TICKET_API_PATH || pathname.startsWith(TICKET_API_PATH + "/")) {
    const sessionCookie = request.cookies.get("session_id");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Session validity is verified server-side in the API route
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/staff", "/api/:path*"],
};
