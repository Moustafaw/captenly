export type ContactChannelKind = "whatsapp" | "facebook" | "instagram" | "x" | "threads";

export interface ResolvedContactChannel {
  kind: ContactChannelKind;
  labelAr: string;
  shortLabelAr: string;
  url: string;
  rawValue: string;
  buttonBgClass: string;
}

export function normalizeSocialUrl(
  value: string | undefined,
  platform: Exclude<ContactChannelKind, "whatsapp">
): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@+/, "").replace(/^\/+/, "");
  switch (platform) {
    case "facebook":
      return handle.includes("facebook.com") || handle.includes("fb.com")
        ? `https://${handle}`
        : `https://facebook.com/${handle}`;
    case "instagram":
      return handle.includes("instagram.com")
        ? `https://${handle}`
        : `https://instagram.com/${handle}`;
    case "x":
      return handle.includes("x.com") || handle.includes("twitter.com")
        ? `https://${handle}`
        : `https://x.com/${handle}`;
    case "threads":
      return handle.includes("threads.net")
        ? `https://${handle}`
        : `https://threads.net/@${handle}`;
  }
}

export function formatWhatsappNumberUrl(phone: string | undefined, text?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const intl = digits.startsWith("20")
    ? digits
    : digits.startsWith("0")
    ? `2${digits}`
    : `20${digits}`;
  return text ? `https://wa.me/${intl}?text=${encodeURIComponent(text)}` : `https://wa.me/${intl}`;
}

/**
 * Resolves contact buttons for facilities & coaches cleanly:
 * - Unclaimed Google-sourced facilities (`seeded_unclaimed`) show NO contact buttons/links at all.
 * - Registered entities show WhatsApp as the primary larger CTA if present; otherwise Facebook or Instagram becomes the primary CTA, and extra channels render as compact icon buttons beside it.
 */
export function resolveEntityContactChannels(input: {
  supplyStatus?: "verified_active" | "self_listed_pending" | "seeded_unclaimed";
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
}): {
  primary: ResolvedContactChannel | null;
  secondary: ResolvedContactChannel[];
  hasAny: boolean;
} {
  if (input.supplyStatus === "seeded_unclaimed") {
    return { primary: null, secondary: [], hasAny: false };
  }

  const channels: ResolvedContactChannel[] = [];
  const waDigits = (input.whatsappNumber || "").replace(/\D/g, "");
  if (waDigits.length >= 8) {
    channels.push({
      kind: "whatsapp",
      labelAr: "تواصل واتساب",
      shortLabelAr: "واتساب",
      url: formatWhatsappNumberUrl(waDigits),
      rawValue: input.whatsappNumber!.trim(),
      buttonBgClass: "bg-action-whatsapp text-surface-card",
    });
  }

  const fbUrl = normalizeSocialUrl(input.facebookUrl, "facebook");
  if (fbUrl) {
    channels.push({
      kind: "facebook",
      labelAr: "صفحة فيسبوك",
      shortLabelAr: "فيسبوك",
      url: fbUrl,
      rawValue: input.facebookUrl!.trim(),
      buttonBgClass: "bg-[#1877F2] text-white",
    });
  }

  const igUrl = normalizeSocialUrl(input.instagramUrl, "instagram");
  if (igUrl) {
    channels.push({
      kind: "instagram",
      labelAr: "حساب إنستجرام",
      shortLabelAr: "إنستجرام",
      url: igUrl,
      rawValue: input.instagramUrl!.trim(),
      buttonBgClass: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white",
    });
  }

  if (channels.length === 0) {
    return { primary: null, secondary: [], hasAny: false };
  }

  const [primary, ...secondary] = channels;
  return { primary, secondary, hasAny: true };
}
