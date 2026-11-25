import { NextResponse } from "next/server";
import { getGoogleOAuthReadiness } from "@/lib/googleAuthConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = getGoogleOAuthReadiness();
  return NextResponse.json({
    ...readiness,
    // Security remediation (F-001): never enable unauthenticated preview login bypass
    previewAllowed: false,
    callbackPath: "/api/auth/callback/google",
  });
}
