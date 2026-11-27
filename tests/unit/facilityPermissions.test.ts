import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getFacilityRoleCapabilities,
  hasFacilityCapability,
  resolveFacilityUiAccessRole,
  type FacilityAccessRole,
  type FacilityCapability,
} from "@/lib/facilityPermissions";

const ALL_CAPS: FacilityCapability[] = [
  "manage_pricing",
  "manage_linked_entities",
  "edit_linked_entity_collections",
  "manage_staff",
  "manage_facility_profile",
  "manage_subscriptions_and_gate",
  "view_facility_links",
  "publish_articles",
];

describe("facilityPermissions: RBAC matrix parity across all roles", () => {
  it("grants full capabilities to owner and admin", () => {
    for (const role of ["owner", "admin"] as const) {
      const caps = getFacilityRoleCapabilities(role);
      for (const cap of ALL_CAPS) {
        assert.equal(caps[cap], true, `${role} must have ${cap}`);
        assert.equal(hasFacilityCapability(role, cap), true);
      }
    }
  });

  it("denies manage_staff to general_staff while allowing other facility ops (OQ-003)", () => {
    const caps = getFacilityRoleCapabilities("general_staff");
    assert.equal(caps.manage_staff, false);
    assert.equal(caps.manage_pricing, true);
    assert.equal(caps.manage_linked_entities, true);
    assert.equal(caps.edit_linked_entity_collections, true);
    assert.equal(caps.manage_facility_profile, true);
    assert.equal(caps.manage_subscriptions_and_gate, true);
    assert.equal(caps.view_facility_links, true);
    assert.equal(caps.publish_articles, true);
  });

  it("restricts accounts_manager to pricing & view_facility_links only (OQ-002)", () => {
    const caps = getFacilityRoleCapabilities("accounts_manager");
    assert.equal(caps.manage_pricing, true);
    assert.equal(caps.view_facility_links, true);
    assert.equal(caps.manage_linked_entities, false);
    assert.equal(caps.edit_linked_entity_collections, false);
    assert.equal(caps.manage_staff, false);
    assert.equal(caps.manage_facility_profile, false);
    assert.equal(caps.manage_subscriptions_and_gate, false);
    assert.equal(caps.publish_articles, false);
  });

  it("restricts subscriptions_manager to subscriptions/gate and view_facility_links", () => {
    const caps = getFacilityRoleCapabilities("subscriptions_manager");
    assert.equal(caps.manage_subscriptions_and_gate, true);
    assert.equal(caps.view_facility_links, true);
    assert.equal(caps.manage_pricing, false);
    assert.equal(caps.manage_linked_entities, false);
    assert.equal(caps.edit_linked_entity_collections, false);
    assert.equal(caps.manage_staff, false);
    assert.equal(caps.manage_facility_profile, false);
    assert.equal(caps.publish_articles, false);
  });

  it("returns all false for null/undefined/unknown roles and resolves UI role cleanly", () => {
    for (const badRole of [null, undefined, "unknown_role" as unknown as FacilityAccessRole]) {
      const caps = getFacilityRoleCapabilities(badRole);
      for (const cap of ALL_CAPS) {
        assert.equal(caps[cap], false);
        assert.equal(hasFacilityCapability(badRole, cap), false);
      }
    }

    assert.equal(
      resolveFacilityUiAccessRole({ isStaffMode: true, staffRole: "accounts_manager", isAdmin: true }),
      "admin"
    );
    assert.equal(
      resolveFacilityUiAccessRole({ isStaffMode: false, staffRole: null }),
      "owner"
    );
    assert.equal(
      resolveFacilityUiAccessRole({ isStaffMode: true, staffRole: "subscriptions_manager" }),
      "subscriptions_manager"
    );
    assert.equal(resolveFacilityUiAccessRole({ isStaffMode: true, staffRole: null }), null);
  });
});
