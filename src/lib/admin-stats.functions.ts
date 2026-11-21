import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DatabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

interface AdminStatsDatabase {
  rpc(functionName: "get_admin_ticket_stats"): PromiseLike<DatabaseResult>;
}

export type AdminRecentBooking = {
  key: string;
  id: string;
  customer: string;
  tour: string;
  amount: number;
  status: "sold";
};

export type AdminTicketStats = {
  totalSoldCount: number;
  current30DaySoldCount: number;
  previous30DaySoldCount: number;
  current30DayRevenue: number;
  previous30DayRevenue: number;
  recentBookings: AdminRecentBooking[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAdminTicketStats(value: unknown): AdminTicketStats | null {
  if (!isRecord(value) || !Array.isArray(value["recentBookings"])) return null;

  const totalSoldCount = toFiniteNumber(value["totalSoldCount"]);
  const current30DaySoldCount = toFiniteNumber(value["current30DaySoldCount"]);
  const previous30DaySoldCount = toFiniteNumber(value["previous30DaySoldCount"]);
  const current30DayRevenue = toFiniteNumber(value["current30DayRevenue"]);
  const previous30DayRevenue = toFiniteNumber(value["previous30DayRevenue"]);
  if (
    totalSoldCount === null ||
    current30DaySoldCount === null ||
    previous30DaySoldCount === null ||
    current30DayRevenue === null ||
    previous30DayRevenue === null
  ) {
    return null;
  }

  const recentBookings: AdminRecentBooking[] = [];
  for (const booking of value["recentBookings"]) {
    if (!isRecord(booking)) return null;
    const amount = toFiniteNumber(booking["amount"]);
    if (
      typeof booking["key"] !== "string" ||
      typeof booking["id"] !== "string" ||
      typeof booking["customer"] !== "string" ||
      typeof booking["tour"] !== "string" ||
      booking["status"] !== "sold" ||
      amount === null
    ) {
      return null;
    }
    recentBookings.push({
      key: booking["key"],
      id: booking["id"],
      customer: booking["customer"],
      tour: booking["tour"],
      amount,
      status: "sold",
    });
  }

  return {
    totalSoldCount,
    current30DaySoldCount,
    previous30DaySoldCount,
    current30DayRevenue,
    previous30DayRevenue,
    recentBookings,
  };
}

export const getAdminTicketStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({}))
  .handler(async ({ context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();

    if (profileError) {
      console.error("[admin-stats] Unable to verify the current user's role.", profileError);
      throw new Error("Admin access could not be verified.");
    }
    if (profile?.role !== "admin") {
      throw new Error("Admin access required.");
    }

    let data: unknown;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const database = supabaseAdmin as unknown as AdminStatsDatabase;
      const result = await database.rpc("get_admin_ticket_stats");
      if (result.error) {
        console.error("[admin-stats] Unable to load ticket statistics.", result.error);
        throw new Error("Ticket statistics could not be loaded.");
      }
      data = result.data;
    } catch (error) {
      if (error instanceof Error && error.message === "Ticket statistics could not be loaded.") {
        throw error;
      }
      console.error("[admin-stats] Admin ticket statistics request failed.", error);
      throw new Error("Ticket statistics could not be loaded.");
    }

    const stats = parseAdminTicketStats(data);
    if (!stats) {
      console.error("[admin-stats] The ticket statistics response was invalid.", data);
      throw new Error("Ticket statistics could not be loaded.");
    }
    return stats;
  });
