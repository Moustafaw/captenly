import { NextResponse } from "next/server";
import { getGoogleOAuthReadiness } from "@/lib/googleAuthConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = getGoogleOAuthReadiness();
  return NextResponse.json({
    ...readiness,
    callbackPath: "/api/auth/callback/google",
  });
}
