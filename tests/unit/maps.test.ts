import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDistanceKm,
  cleanPublicAddressAr,
  facilityMatchesCity,
  facilityMatchesSearch,
  formatDistanceAr,
  getFacilityDistanceKm,
  getNearestFacilityLocation,
  stripPlusCode,
} from "@/lib/maps";

describe("maps: Plus Code stripping, Haversine distance & city/branch matching", () => {
  it("strips raw Plus Codes even adjacent to Arabic text and cleans punctuation", () => {
    assert.equal(stripPlusCode("X529+F73، شارع البحر، طنطا"), "، شارع البحر، طنطا");
    assert.equal(cleanPublicAddressAr("X529+F73، شارع البحر، طنطا"), "شارع البحر، طنطا");
    assert.equal(
      cleanPublicAddressAr("شارع الجيشX529+F73طنطا، الغربية"),
      "شارع الجيش طنطا، الغربية"
    );
    assert.equal(cleanPublicAddressAr("8G2Q+9X - مدينة نصر، القاهرة"), "مدينة نصر، القاهرة");
    assert.equal(
      cleanPublicAddressAr("8G2P8G2Q+9X، كورنيش النيل، المعادي"),
      "كورنيش النيل، المعادي"
    );
    assert.equal(cleanPublicAddressAr("X529+F73"), "");
    assert.equal(cleanPublicAddressAr(null), "");
    assert.equal(cleanPublicAddressAr(undefined), "");
    assert.equal(cleanPublicAddressAr("شارع 26 يوليو، الزمالك"), "شارع 26 يوليو، الزمالك");
  });

  it("computes accurate Haversine distances and Arabic formatting", () => {
    assert.equal(calculateDistanceKm(30.0444, 31.2357, 30.0444, 31.2357), 0);

    const cairoToAlex = calculateDistanceKm(30.0444, 31.2357, 31.2001, 29.9187);
    assert.ok(cairoToAlex > 170 && cairoToAlex < 190, `Unexpected distance: ${cairoToAlex}`);

    const tantaToMahalla = calculateDistanceKm(30.7865, 31.0004, 30.9706, 31.1669);
    assert.ok(tantaToMahalla > 22 && tantaToMahalla < 28);

    assert.equal(formatDistanceAr(0.01), "50 م");
    assert.equal(formatDistanceAr(0.45), "450 م");
    assert.equal(formatDistanceAr(3.26), "3.3 كم");
    assert.equal(formatDistanceAr(-1), "");
    assert.equal(formatDistanceAr(Number.NaN), "");
  });

  it("matches cities and searches across primary and multi-branch locations", () => {
    const multiBranch = {
      id: "fac-multi",
      nameAr: "أكاديمية الدلتا",
      nameEn: "Delta Aquatics",
      city: "طنطا",
      governorate: "الغربية",
      district: "الاستاد",
      addressAr: "شارع الاستاد",
      coordinates: { lat: 30.7865, lng: 31.0004 },
      specialtiesAr: ["تأسيس الأطفال"],
      locations: [
        {
          id: "loc-tanta",
          labelAr: "فرع طنطا",
          governorate: "الغربية",
          city: "طنطا",
          district: "الاستاد",
          addressAr: "شارع الاستاد",
          coordinates: { lat: 30.7865, lng: 31.0004 },
        },
        {
          id: "loc-maadi",
          labelAr: "فرع المعادي",
          governorate: "القاهرة",
          city: "المعادي",
          district: "زهراء المعادي",
          addressAr: "شارع الخمسين",
          coordinates: { lat: 29.9602, lng: 31.2569 },
        },
      ],
    };

    assert.equal(facilityMatchesCity(multiBranch, "الكل"), true);
    assert.equal(facilityMatchesCity(multiBranch, "كل مصر"), true);
    assert.equal(facilityMatchesCity(multiBranch, "المعادي"), true);
    assert.equal(facilityMatchesCity(multiBranch, "الإسكندرية"), false);

    assert.equal(facilityMatchesSearch(multiBranch, "خمسين"), true);
    assert.equal(facilityMatchesSearch(multiBranch, "delta"), true);
    assert.equal(facilityMatchesSearch(multiBranch, "أسوان"), false);

    const nearest = getNearestFacilityLocation(multiBranch, { lat: 29.97, lng: 31.26 });
    assert.equal(nearest.location.id, "loc-maadi");
    assert.ok(getFacilityDistanceKm(multiBranch, { lat: 29.97, lng: 31.26 }) < 2);
  });
});
