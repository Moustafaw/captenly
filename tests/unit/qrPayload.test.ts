import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCaptenlyQrUrl, parseCaptenlyQr } from "@/lib/qrPayload";

describe("qrPayload: parseCaptenlyQr & buildCaptenlyQrUrl", () => {
  it("parses CAP-SUB:* prefixed and raw subscription codes", () => {
    assert.deepEqual(parseCaptenlyQr("CAP-SUB:sub-4821-a3"), {
      kind: "subscription_qr",
      subscriptionCode: "SUB-4821-A3",
    });

    assert.deepEqual(parseCaptenlyQr("CAP-SUB-301"), {
      kind: "subscription_qr",
      subscriptionCode: "CAP-SUB-301",
    });

    assert.deepEqual(parseCaptenlyQr("  sub-9001-b7  "), {
      kind: "subscription_qr",
      subscriptionCode: "SUB-9001-B7",
    });
  });

  it("parses CAP-M-*, CAP-JR-*, CAP-C-*, CAP-F-*, and CAP-MEMBER:* member payloads", () => {
    assert.deepEqual(parseCaptenlyQr("CAP-M-3001"), {
      kind: "member_qr",
      memberCode: "CAP-M-3001",
    });

    assert.deepEqual(parseCaptenlyQr("cap-jr-3001-02"), {
      kind: "member_qr",
      memberCode: "CAP-JR-3001-02",
    });

    assert.deepEqual(parseCaptenlyQr("CAP-MEMBER:cap-c-1122"), {
      kind: "member_qr",
      memberCode: "CAP-C-1122",
    });

    assert.deepEqual(parseCaptenlyQr("CAP-F-8899"), {
      kind: "member_qr",
      memberCode: "CAP-F-8899",
    });
  });

  it("parses CAP-QR:<ledger>:<pin> legacy ledger payloads", () => {
    assert.deepEqual(parseCaptenlyQr("CAP-QR:led-101:4829"), {
      kind: "ledger_qr",
      ledgerCode: "LED-101",
      pinCode: "4829",
    });
  });

  it("parses JSON payloads for subscription, ledger, and member codes", () => {
    assert.deepEqual(parseCaptenlyQr('{"subCode":"sub-7711-c2"}'), {
      kind: "subscription_qr",
      subscriptionCode: "SUB-7711-C2",
    });

    assert.deepEqual(parseCaptenlyQr('{"subscriptionCode":"CAP-SUB-88"}'), {
      kind: "subscription_qr",
      subscriptionCode: "CAP-SUB-88",
    });

    assert.deepEqual(parseCaptenlyQr('{"ledgerCode":"led-42","pinCode":"9191"}'), {
      kind: "ledger_qr",
      ledgerCode: "LED-42",
      pinCode: "9191",
    });

    assert.deepEqual(parseCaptenlyQr('{"code":"sub-5500-k1"}'), {
      kind: "subscription_qr",
      subscriptionCode: "SUB-5500-K1",
    });

    assert.deepEqual(parseCaptenlyQr('{"code":"cap-jr-4400-01"}'), {
      kind: "member_qr",
      memberCode: "CAP-JR-4400-01",
    });
  });

  it("parses URL payloads with ?qr=, ?sub=, and ?code= parameters", () => {
    const subUrl = buildCaptenlyQrUrl("subscription", "sub-1234-a1");
    assert.equal(
      subUrl,
      "https://captenly.vercel.app/dashboard/ledger?qr=CAP-SUB%3ASUB-1234-A1"
    );
    assert.deepEqual(parseCaptenlyQr(subUrl), {
      kind: "subscription_qr",
      subscriptionCode: "SUB-1234-A1",
    });

    const memberUrl = buildCaptenlyQrUrl("member", "cap-jr-2233-01");
    assert.deepEqual(parseCaptenlyQr(memberUrl), {
      kind: "member_qr",
      memberCode: "CAP-JR-2233-01",
    });

    assert.deepEqual(parseCaptenlyQr("/dashboard/ledger?qr=CAP-M-9090"), {
      kind: "member_qr",
      memberCode: "CAP-M-9090",
    });

    assert.deepEqual(
      parseCaptenlyQr("https://captenly.vercel.app/dashboard/ledger?sub=SUB-3322-Z9"),
      {
        kind: "subscription_qr",
        subscriptionCode: "SUB-3322-Z9",
      }
    );

    assert.deepEqual(
      parseCaptenlyQr("https://captenly.vercel.app/dashboard/ledger?code=CAP-M-1212"),
      {
        kind: "member_qr",
        memberCode: "CAP-M-1212",
      }
    );
  });

  it("handles empty, whitespace, malformed JSON, and unknown strings safely", () => {
    assert.deepEqual(parseCaptenlyQr(""), { kind: "unknown", raw: "" });
    assert.deepEqual(parseCaptenlyQr("   \n\t  "), { kind: "unknown", raw: "" });
    assert.deepEqual(parseCaptenlyQr("{invalid-json"), {
      kind: "unknown",
      raw: "{invalid-json",
    });
    assert.deepEqual(parseCaptenlyQr("https://captenly.vercel.app/explore"), {
      kind: "unknown",
      raw: "https://captenly.vercel.app/explore",
    });
    assert.equal(buildCaptenlyQrUrl("subscription", "   "), "https://captenly.vercel.app");
  });
});
