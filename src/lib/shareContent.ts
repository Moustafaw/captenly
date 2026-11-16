export interface SharePayload {
  title: string;
  text: string;
  url?: string;
}

export type ShareInvokeOutcome =
  | { status: "shared" }
  | { status: "cancelled" }
  | { status: "fallback" };

/**
 * Resolves the canonical URL to share on the client.
 */
export function resolveShareUrl(explicitUrl?: string): string {
  if (explicitUrl) {
    if (explicitUrl.startsWith("http://") || explicitUrl.startsWith("https://")) {
      return explicitUrl;
    }
    if (typeof window !== "undefined") {
      return `${window.location.origin}${explicitUrl.startsWith("/") ? explicitUrl : `/${explicitUrl}`}`;
    }
    return `https://captenly.vercel.app${explicitUrl.startsWith("/") ? explicitUrl : `/${explicitUrl}`}`;
  }
  if (typeof window !== "undefined") {
    return window.location.href;
  }
  return "https://captenly.vercel.app";
}

/**
 * Attempts to open the device's native OS Share Sheet first (`navigator.share`).
 * Only requests our cross-platform fallback modal when native sharing is unavailable.
 */
export async function triggerNativeShare(payload: SharePayload): Promise<ShareInvokeOutcome> {
  const url = resolveShareUrl(payload.url);
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url,
      });
      return { status: "shared" };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { status: "cancelled" };
      }
      // Fall through cleanly if the browser rejects navigator.share (e.g. non-secure context or desktop limitation)
    }
  }
  return { status: "fallback" };
}
