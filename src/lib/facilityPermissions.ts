import type { FacilityStaffRole } from "@/types/captenly";

export type FacilityAccessRole = FacilityStaffRole | "owner" | "admin";

export type FacilityCapability =
  | "manage_pricing"
  | "manage_linked_entities"
  | "edit_linked_entity_collections"
  | "manage_staff"
  | "manage_facility_profile"
  | "manage_subscriptions_and_gate"
  | "view_facility_links"
  | "publish_articles";

const EMPTY_CAPABILITIES: Record<FacilityCapability, boolean> = {
  manage_pricing: false,
  manage_linked_entities: false,
  edit_linked_entity_collections: false,
  manage_staff: false,
  manage_facility_profile: false,
  manage_subscriptions_and_gate: false,
  view_facility_links: false,
  publish_articles: false,
};

/**
 * Single source of truth for facility role capabilities across UI and API routes.
 * Preserves OQ-002 (accounts_manager cannot mutate facility-links) and
 * OQ-003 (general_staff cannot add/remove facility staffMembers).
 */
const FACILITY_ROLE_CAPABILITIES: Record<
  FacilityAccessRole,
  Record<FacilityCapability, boolean>
> = {
  owner: {
    manage_pricing: true,
    manage_linked_entities: true,
    edit_linked_entity_collections: true,
    manage_staff: true,
    manage_facility_profile: true,
    manage_subscriptions_and_gate: true,
    view_facility_links: true,
    publish_articles: true,
  },
  admin: {
    manage_pricing: true,
    manage_linked_entities: true,
    edit_linked_entity_collections: true,
    manage_staff: true,
    manage_facility_profile: true,
    manage_subscriptions_and_gate: true,
    view_facility_links: true,
    publish_articles: true,
  },
  general_staff: {
    manage_pricing: true,
    manage_linked_entities: true,
    edit_linked_entity_collections: true,
    manage_staff: false, // OQ-003: server preserves existing staffMembers for general_staff
    manage_facility_profile: true,
    manage_subscriptions_and_gate: true,
    view_facility_links: true,
    publish_articles: true,
  },
  accounts_manager: {
    manage_pricing: true,
    manage_linked_entities: false, // OQ-002: server restricts facility-links mutations
    edit_linked_entity_collections: false, // OQ-002: uses PATCH /api/supabase/facility-links
    manage_staff: false,
    manage_facility_profile: false,
    manage_subscriptions_and_gate: false,
    view_facility_links: true,
    publish_articles: false,
  },
  subscriptions_manager: {
    manage_pricing: false,
    manage_linked_entities: false,
    edit_linked_entity_collections: false,
    manage_staff: false,
    manage_facility_profile: false,
    manage_subscriptions_and_gate: true,
    view_facility_links: true,
    publish_articles: false,
  },
};

export function getFacilityRoleCapabilities(
  accessRole: FacilityAccessRole | null | undefined
): Record<FacilityCapability, boolean> {
  if (!accessRole) return { ...EMPTY_CAPABILITIES };
  const caps = FACILITY_ROLE_CAPABILITIES[accessRole];
  return caps ? { ...caps } : { ...EMPTY_CAPABILITIES };
}

export function hasFacilityCapability(
  accessRole: FacilityAccessRole | null | undefined,
  capability: FacilityCapability
): boolean {
  if (!accessRole) return false;
  return Boolean(FACILITY_ROLE_CAPABILITIES[accessRole]?.[capability]);
}

export function resolveFacilityUiAccessRole(params: {
  isStaffMode: boolean;
  staffRole: FacilityStaffRole | null | undefined;
  isAdmin?: boolean;
}): FacilityAccessRole | null {
  if (params.isAdmin) return "admin";
  if (!params.isStaffMode) return "owner";
  return params.staffRole ?? null;
}
