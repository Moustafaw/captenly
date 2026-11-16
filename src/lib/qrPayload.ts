export type ParsedQrResult =
  | { kind: "subscription_qr"; subscriptionCode: string }
  | { kind: "ledger_qr"; ledgerCode: string; pinCode: string }
  | { kind: "member_qr"; memberCode: string }
  | { kind: "unknown"; raw: string };

const DEFAULT_PUBLIC_ORIGIN = "https://captenly.vercel.app";

/**
 * Generates an actionable URL encoded inside Captenly QR codes so BOTH:
 * 1) Phone built-in system / Quick Settings QR scanners open `/dashboard/ledger?qr=...` directly, and
 * 2) Captenly's in-app offline camera scanner (`QrCameraScannerModal`) parses it identically offline.
 */
export function buildCaptenlyQrUrl(kind: "subscription" | "member", rawCode: string): string {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) return DEFAULT_PUBLIC_ORIGIN;
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : DEFAULT_PUBLIC_ORIGIN;
  const token = kind === "subscription" ? `CAP-SUB:${code}` : `CAP-MEMBER:${code}`;
  return `${origin}/dashboard/ledger?qr=${encodeURIComponent(token)}`;
}

/**
 * Extracts a structured Captenly token from URLs (`?qr=...`, `?sub=...`, `?code=...`),
 * JSON objects, prefixed tokens (`CAP-SUB:`, `CAP-MEMBER:`, `CAP-QR:`), or raw IDs.
 */
export function parseCaptenlyQr(raw: string): ParsedQrResult {
  const clean = (raw || "").trim();
  if (!clean) return { kind: "unknown", raw: "" };

  // 1. URL format (from phone system camera / Quick Settings QR scanner)
  if (
    clean.startsWith("http://") ||
    clean.startsWith("https://") ||
    clean.startsWith("/dashboard/ledger") ||
    clean.includes("?qr=") ||
    clean.includes("&qr=")
  ) {
    try {
      const parsedUrl = new URL(clean, DEFAULT_PUBLIC_ORIGIN);
      const inner =
        parsedUrl.searchParams.get("qr") ||
        parsedUrl.searchParams.get("sub") ||
        parsedUrl.searchParams.get("code");
      if (inner && inner.trim() && inner.trim() !== clean) {
        return parseCaptenlyQr(inner);
      }
    } catch {
      // Fall through to plain-string parsers
    }
  }

  // 2. JSON payload format
  if (clean.startsWith("{") && clean.endsWith("}")) {
    try {
      const obj = JSON.parse(clean) as {
        subCode?: string;
        subscriptionCode?: string;
        code?: string;
        ledgerCode?: string;
        pinCode?: string;
      };
      if (obj.subCode || obj.subscriptionCode) {
        return {
          kind: "subscription_qr",
          subscriptionCode: String(obj.subCode || obj.subscriptionCode).trim().toUpperCase(),
        };
      }
      if (obj.ledgerCode) {
        return {
          kind: "ledger_qr",
          ledgerCode: String(obj.ledgerCode).trim().toUpperCase(),
          pinCode: String(obj.pinCode || "").trim(),
        };
      }
      if (obj.code) {
        const c = String(obj.code).trim().toUpperCase();
        if (c.startsWith("SUB-")) {
          return { kind: "subscription_qr", subscriptionCode: c };
        }
        return { kind: "member_qr", memberCode: c };
      }
    } catch {
      // Fall through
    }
  }

  // 3. Prefixed tokens & raw codes
  const upper = clean.toUpperCase();
  if (upper.startsWith("CAP-SUB:")) {
    return {
      kind: "subscription_qr",
      subscriptionCode: clean.slice("CAP-SUB:".length).trim().toUpperCase(),
    };
  }
  if (/^SUB-[A-Z0-9-]{3,16}$/i.test(clean)) {
    return { kind: "subscription_qr", subscriptionCode: upper };
  }
  if (upper.startsWith("CAP-QR:")) {
    const parts = clean.split(":");
    return {
      kind: "ledger_qr",
      ledgerCode: (parts[1] || "").trim().toUpperCase(),
      pinCode: (parts[2] || "").trim(),
    };
  }
  if (upper.startsWith("CAP-MEMBER:")) {
    return {
      kind: "member_qr",
      memberCode: clean.slice("CAP-MEMBER:".length).trim().toUpperCase(),
    };
  }
  if (/^CAP-(M|JR|C|F)-[A-Z0-9-]+$/i.test(clean)) {
    return { kind: "member_qr", memberCode: upper };
  }

  return { kind: "unknown", raw: clean };
}
