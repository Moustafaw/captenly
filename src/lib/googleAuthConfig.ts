export interface GoogleOAuthReadiness {
  configured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasAuthSecret: boolean;
  missingKeys: string[];
}

export function getGoogleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "").trim();
}

export function getGoogleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "").trim();
}

export function getAuthSecret(): string {
  return (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "").trim();
}

export function getGoogleOAuthReadiness(): GoogleOAuthReadiness {
  const hasClientId = Boolean(getGoogleClientId());
  const hasClientSecret = Boolean(getGoogleClientSecret());
  const hasAuthSecret = Boolean(getAuthSecret());

  const missingKeys: string[] = [];
  if (!hasClientId) missingKeys.push("GOOGLE_CLIENT_ID");
  if (!hasClientSecret) missingKeys.push("GOOGLE_CLIENT_SECRET");
  if (!hasAuthSecret) missingKeys.push("AUTH_SECRET");

  return {
    configured: hasClientId && hasClientSecret && hasAuthSecret,
    hasClientId,
    hasClientSecret,
    hasAuthSecret,
    missingKeys,
  };
}
