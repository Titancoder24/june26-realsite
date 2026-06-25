import { createAdminClient } from "@/lib/supabase/admin";
import type { InventoryStatus } from "@/types/domain";

interface ChangeStatusParams {
  propertyId: string;
  organizationId: string;
  toStatus: InventoryStatus;
  changedBy?: string;
  leadId?: string;
  reason?: string;
  /** Hold duration in hours (only used when toStatus = on_hold) */
  holdHours?: number;
  priceCurrent?: number;
}

export class InventoryService {
  async changeStatus(params: ChangeStatusParams) {
    const admin = createAdminClient();

    const { data: property, error: readError } = await admin
      .from("properties")
      .select("id, availability, organization_id")
      .eq("id", params.propertyId)
      .eq("organization_id", params.organizationId)
      .single();

    if (readError || !property) throw new Error("Property not found");

    const fromStatus = property.availability ?? "available";

    const patch: Record<string, unknown> = {
      availability: params.toStatus,
      availability_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (params.priceCurrent !== undefined) patch.price_current = params.priceCurrent;

    if (params.toStatus === "on_hold") {
      const hours = params.holdHours ?? 24;
      patch.hold_expires_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      patch.held_by_lead_id = params.leadId ?? null;
    } else {
      // Clear hold metadata on any non-hold transition
      patch.hold_expires_at = null;
      patch.held_by_lead_id = null;
    }

    const { data: updated, error: updateError } = await admin
      .from("properties")
      .update(patch)
      .eq("id", params.propertyId)
      .eq("organization_id", params.organizationId)
      .select()
      .single();

    if (updateError) throw updateError;

    await admin.from("inventory_changes").insert({
      organization_id: params.organizationId,
      property_id: params.propertyId,
      changed_by: params.changedBy,
      lead_id: params.leadId,
      from_status: fromStatus,
      to_status: params.toStatus,
      reason: params.reason,
      metadata: params.priceCurrent !== undefined ? { price_current: params.priceCurrent } : {},
    });

    return updated;
  }

  async listInventory(organizationId: string, filters?: { projectId?: string; status?: string }) {
    const admin = createAdminClient();
    let q = admin
      .from("properties")
      .select(
        "id, name, unit_number, unit_type, configuration, tower, floor, facing, area, price_min, price_max, price_current, availability, hold_expires_at, held_by_lead_id, availability_updated_at, project_id",
      )
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (filters?.projectId) q = q.eq("project_id", filters.projectId);
    if (filters?.status) q = q.eq("availability", filters.status);

    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async getHistory(propertyId: string, organizationId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("inventory_changes")
      .select("*, profiles:changed_by(full_name)")
      .eq("property_id", propertyId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  /** Release holds that have expired back to available. Safe to call from a cron. */
  async releaseExpiredHolds(organizationId?: string) {
    const admin = createAdminClient();
    let q = admin
      .from("properties")
      .select("id, organization_id")
      .eq("availability", "on_hold")
      .lt("hold_expires_at", new Date().toISOString());
    if (organizationId) q = q.eq("organization_id", organizationId);

    const { data: expired } = await q;
    if (!expired?.length) return { released: 0 };

    for (const prop of expired) {
      await this.changeStatus({
        propertyId: prop.id,
        organizationId: prop.organization_id,
        toStatus: "available",
        reason: "Hold expired automatically",
      });
    }

    return { released: expired.length };
  }

  summarize(properties: { availability?: string | null }[]) {
    const counts: Record<string, number> = { available: 0, on_hold: 0, booked: 0, sold: 0, blocked: 0 };
    for (const p of properties) {
      const key = p.availability ?? "available";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }
}

export const inventoryService = new InventoryService();
