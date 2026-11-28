import { NextResponse } from "next/server";
import crypto from "crypto";
import { updateWhatsAppDeliveryStatusByProviderId } from "@/lib/server/whatsappNotifications";

export const runtime = "nodejs";

function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = (process.env.WHATSAPP_APP_SECRET || "").trim();
  if (!appSecret) {
    // Allow signature-less delivery only if WHATSAPP_APP_SECRET is unset (e.g., initial Meta dev sandbox).
    return true;
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const receivedHex = signatureHeader.slice("sha256=".length).trim().toLowerCase();
  const expectedHex = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex")
    .toLowerCase();

  const a = Buffer.from(receivedHex, "utf8");
  const b = Buffer.from(expectedHex, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Official Meta WhatsApp Cloud API Webhook Challenge Verification (GET).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token") || "";
  const challenge = searchParams.get("hub.challenge") || "";
  const expectedToken = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim();

  if (mode !== "subscribe" || !expectedToken || !challenge) {
    return new Response("Forbidden", { status: 403 });
  }

  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expectedToken, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Official Meta WhatsApp Cloud API Webhook Delivery Status Receiver (POST).
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const sigHeader = request.headers.get("x-hub-signature-256");
    if (!verifyMetaWebhookSignature(rawBody, sigHeader)) {
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody || "{}") as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id?: string;
              status?: string;
              errors?: Array<{ code?: number | string; title?: string; message?: string }>;
            }>;
          };
        }>;
      }>;
    };

    let processed = 0;
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const statuses = change.value?.statuses || [];
        for (const st of statuses) {
          const msgId = st.id ? String(st.id).trim() : "";
          const rawStatus = st.status ? String(st.status).toLowerCase() : "";
          if (
            msgId &&
            (rawStatus === "sent" ||
              rawStatus === "delivered" ||
              rawStatus === "read" ||
              rawStatus === "failed")
          ) {
            const firstErr = st.errors?.[0];
            await updateWhatsAppDeliveryStatusByProviderId({
              providerMessageId: msgId,
              status: rawStatus,
              errorCode: firstErr?.code ? String(firstErr.code) : null,
              errorDetail: firstErr?.message || firstErr?.title || null,
            });
            processed += 1;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
}
