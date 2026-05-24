"use client";

import { SessionProvider } from "next-auth/react";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const runtimeOrigin =
    typeof window !== "undefined" && window.location.origin.startsWith("http")
      ? window.location.origin
      : "http://localhost:3000";

  return (
    <SessionProvider
      baseUrl={runtimeOrigin}
      basePath="/api/auth"
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
}
