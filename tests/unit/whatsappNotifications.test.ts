import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildArabicMessageForEvent,
  buildWhatsAppDedupeKey,
  getCairoDateString,
  getWhatsAppProviderStatus,
  maskPhoneLast4,
  normalizeWhatsAppPhone,
} from "@/lib/server/whatsappNotifications";

describe("WhatsApp notification helpers", () => {
  it("normalizes Egyptian mobile and international phone formats to E.164 digits", () => {
    assert.equal(normalizeWhatsAppPhone("01012345678"), "201012345678");
    assert.equal(normalizeWhatsAppPhone("+20 101 234 5678"), "201012345678");
    assert.equal(normalizeWhatsAppPhone("00201122334455"), "201122334455");
    assert.equal(normalizeWhatsAppPhone("1098765432"), "201098765432");
    assert.equal(normalizeWhatsAppPhone("123"), null);
    assert.equal(normalizeWhatsAppPhone(""), null);
    assert.equal(maskPhoneLast4("201012345678"), "****5678");
  });

  it("formats Africa/Cairo dates cleanly and produces deterministic dedupe keys", () => {
    const cairoDate = getCairoDateString(new Date("2026-11-28T00:30:00Z"));
    assert.equal(cairoDate, "2026-11-28");

    const k1 = buildWhatsAppDedupeKey({
      eventType: "attendance_checkin",
      recipientMemberCode: "cap-m-1001",
      ledgerId: "led-1",
      dateKey: "2026-11-28",
      dedupeScope: "led-1-s3",
    });
    const k2 = buildWhatsAppDedupeKey({
      eventType: "attendance_checkin",
      recipientMemberCode: "CAP-M-1001",
      ledgerId: "led-1",
      dateKey: "2026-11-28",
      dedupeScope: "led-1-s3",
    });
    assert.equal(k1, "attendance_checkin:CAP-M-1001:led-1-s3:2026-11-28");
    assert.equal(k1, k2);
  });

  it("builds truthful Arabic messages and preference mappings across lifecycle events", () => {
    const checkin = buildArabicMessageForEvent("attendance_checkin", {
      athleteNameAr: "يوسف طارق",
      facilityNameAr: "أكاديمية الموج",
      completedSessions: 3,
      totalSessions: 8,
      remainingSessions: 5,
    });
    assert.equal(checkin.preferenceKey, "notifyWhatsappSessions");
    assert.ok(checkin.bodyAr.includes("يوسف طارق"));
    assert.ok(checkin.bodyAr.includes("3/8"));

    const expiry = buildArabicMessageForEvent("subscription_expiring", {
      athleteNameAr: "ليلى كريم",
      facilityNameAr: "نادي الشمس",
      completedSessions: 7,
      totalSessions: 8,
      remainingSessions: 1,
    });
    assert.equal(expiry.preferenceKey, "notifyWhatsappRenewals");
    assert.ok(expiry.bodyAr.includes("1 حصة"));

    const receipt = buildArabicMessageForEvent("receipt_confirmed", {
      athleteNameAr: "ليلى كريم",
      facilityNameAr: "نادي الشمس",
      amountEgp: 950,
    });
    assert.equal(receipt.preferenceKey, "notifyWhatsappRenewals");
    assert.ok(receipt.bodyAr.includes("950"));

    const status = getWhatsAppProviderStatus();
    assert.equal(status.provider, "meta_whatsapp_cloud");
  });
});
