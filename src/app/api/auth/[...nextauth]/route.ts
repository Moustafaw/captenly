import { NextRequest, NextResponse } from "next/server";
import { getAuthInstance } from "@/auth";
import { getGoogleOAuthReadiness } from "@/lib/googleAuthConfig";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authInstance = getAuthInstance();
  if (!authInstance) {
    const pathname = req.nextUrl.pathname;
    if (pathname.endsWith("/session")) {
      return NextResponse.json(null, { status: 200 });
    }
    if (pathname.endsWith("/providers")) {
      return NextResponse.json({}, { status: 200 });
    }
    if (pathname.endsWith("/csrf")) {
      return NextResponse.json({ csrfToken: "" }, { status: 200 });
    }
    if (pathname.endsWith("/_log")) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    return NextResponse.redirect(new URL("/auth/login?google=setup_required", req.url));
  }

  return authInstance.handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const authInstance = getAuthInstance();
  if (!authInstance) {
    const readiness = getGoogleOAuthReadiness();
    return NextResponse.json(
      {
        ok: false,
        error: "GOOGLE_OAUTH_NOT_CONFIGURED",
        missingKeys: readiness.missingKeys,
      },
      { status: 503 }
    );
  }

  return authInstance.handlers.POST(req);
}
