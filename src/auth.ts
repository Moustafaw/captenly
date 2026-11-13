import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  getAuthSecret,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleOAuthReadiness,
} from "@/lib/googleAuthConfig";

type AuthResult = ReturnType<typeof NextAuth>;

let cachedAuth: AuthResult | null = null;

export function getAuthInstance(): AuthResult | null {
  const readiness = getGoogleOAuthReadiness();
  if (!readiness.configured) {
    return null;
  }

  if (!cachedAuth) {
    cachedAuth = NextAuth({
      trustHost: true,
      secret: getAuthSecret(),
      providers: [
        Google({
          clientId: getGoogleClientId(),
          clientSecret: getGoogleClientSecret(),
          authorization: {
            params: {
              prompt: "select_account",
            },
          },
        }),
      ],
      pages: {
        signIn: "/auth/login",
        error: "/auth/login",
      },
      callbacks: {
        async jwt({ token, account, profile }) {
          if (account?.provider === "google" && profile) {
            const p = profile as { picture?: string; name?: string; email?: string };
            if (p.picture) token.picture = p.picture;
            if (p.name) token.name = p.name;
            if (p.email) token.email = p.email;
          }
          return token;
        },
        async session({ session, token }) {
          if (session.user) {
            if (token.sub) session.user.id = token.sub;
            if (typeof token.picture === "string") session.user.image = token.picture;
            if (typeof token.name === "string") session.user.name = token.name;
            if (typeof token.email === "string") session.user.email = token.email;
          }
          return session;
        },
      },
    });
  }

  return cachedAuth;
}
