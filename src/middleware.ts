import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isRateLimited } from "@/shared/lib/rate-limit";
import { getInternalToken } from "@/shared/lib/server/internal-token";
import {
  isAuthRequired,
  isLocalhostRequest,
  isTrustedDevOrigin,
  localhostOnlyDeniedResponse,
  untrustedOriginDeniedResponse,
} from "@/shared/lib/server/request-security";
import { applySecurityHeaders } from "@/shared/lib/server/security-headers";

// Define paths to protect
const PROTECTED_PAGES = ["/dashboard"];
const PROTECTED_API_PREFIX = "/api/";

// Exclude public authentication endpoints and system health checks
const PUBLIC_API_PATHS = [
  "/api/auth",
  "/api/system/status",
  "/api/metrics"
];

// Define AI routes subject to rate limiting
const AI_ROUTES = [
  "/api/generate-article",
  "/api/generate-keywords",
  "/api/generate-outline",
  "/api/generate-section",
  "/api/ai-support",
  "/api/silo-structure",
  "/api/competitor-discovery",
  "/api/seo/llm-run",
  "/api/images/generate",
  "/api/images/scrape"
];

function secure(res: NextResponse) {
  return applySecurityHeaders(res);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isLocalhostRequest(req)) {
    return localhostOnlyDeniedResponse();
  }

  const isProtectedApi =
    pathname.startsWith(PROTECTED_API_PREFIX) &&
    !PUBLIC_API_PATHS.some((pubPath) => pathname.startsWith(pubPath));

  if (isProtectedApi && !isTrustedDevOrigin(req)) {
    return untrustedOriginDeniedResponse();
  }

  // 1. Determine if the route requires authentication
  const isProtectedPage = PROTECTED_PAGES.some((page) => pathname.startsWith(page));

  if (!isProtectedPage && !isProtectedApi) {
    return secure(NextResponse.next());
  }

  // Local ZIP / may dev: khong bat buoc dang nhap (OMNISUITE_REQUIRE_AUTH=1 de bat lai)
  if (!isAuthRequired()) {
    const isAiRouteEarly = AI_ROUTES.some((route) => pathname.startsWith(route));
    if (isAiRouteEarly) {
      const limitMax = parseInt(process.env.AI_RATE_LIMIT_MAX || "10", 10);
      const windowMs = parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || "60000", 10);
      const clientIp = req.headers.get("x-forwarded-for") || (req as any).ip || "127.0.0.1";
      const limitKey = `${pathname}:local:${clientIp}`;
      if (isRateLimited(limitKey, limitMax, windowMs)) {
        return secure(
          new NextResponse(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
    }
    return secure(NextResponse.next());
  }

  // 2. Perform authentication check
  let isAuthenticated = false;
  let userIdentifier = "anonymous";

  // Check for Static Internal Token Bypass
  const internalToken = getInternalToken();
  const authHeader = req.headers.get("authorization");
  const headerToken = req.headers.get("x-internal-token");

  let tokenPassed = false;
  if (internalToken) {
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const bearerToken = authHeader.substring(7).trim();
      if (bearerToken === internalToken) {
        tokenPassed = true;
      }
    } else if (headerToken === internalToken) {
      tokenPassed = true;
    }
  }

  if (tokenPassed) {
    isAuthenticated = true;
    userIdentifier = "internal-service";
  } else {
    // Check NextAuth Session JWT
    try {
      const session = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (session) {
        isAuthenticated = true;
        userIdentifier = session.email || (session.sub ?? "authenticated-user");
      }
    } catch (err) {
      console.error("NextAuth token validation failed in middleware:", err);
    }
  }

  // 3. Handle Unauthorized access
  if (!isAuthenticated) {
    if (isProtectedApi) {
      return secure(
        new NextResponse(
          JSON.stringify({ error: "Unauthorized. Access Denied." }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    } else {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return secure(NextResponse.redirect(loginUrl));
    }
  }

  // 4. Rate Limiting for AI Routes
  const isAiRoute = AI_ROUTES.some((route) => pathname.startsWith(route));
  if (isAiRoute && userIdentifier !== "internal-service") {
    // If not local backend/internal service, apply rate limits
    const limitMax = parseInt(process.env.AI_RATE_LIMIT_MAX || "10", 10);
    const windowMs = parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || "60000", 10);

    // Client key: use user identifier (email/sub) or fallback to client IP
    const clientIp = req.headers.get("x-forwarded-for") || (req as any).ip || "127.0.0.1";
    const limitKey = `${pathname}:${userIdentifier}:${clientIp}`;

    if (isRateLimited(limitKey, limitMax, windowMs)) {
      return secure(
        new NextResponse(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }
  }

  return secure(NextResponse.next());
}

// Configure middleware match patterns
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*"
  ],
};
