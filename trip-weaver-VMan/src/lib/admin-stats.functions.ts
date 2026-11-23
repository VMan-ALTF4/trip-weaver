import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TICKET_HOLD_DURATION_MS } from "@/lib/ticket-hold";

type DatabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

interface AdminStatsDatabase {
  rpc(functionName: "get_admin_ticket_stats"): PromiseLike<DatabaseResult>;
}

type AdminCountResult = {
  count: number | null;
  error: { message: string } | null;
};

interface AdminCountQuery extends PromiseLike<AdminCountResult> {
  eq(column: string, value: string): AdminCountQuery;
  gt(column: string, value: string): AdminCountQuery;
}

interface AdminCountTable {
  select(column: "id", options: { count: "exact"; head: true }): AdminCountQuery;
}

interface AdminSystemStatusDatabase {
  from(table: "ticket" | "eticket_email_log"): AdminCountTable;
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

export type AdminSystemStatus = {
  activeHeldTicketCount: number;
  emailsSent30DayCount: number;
  emailsFailed30DayCount: number;
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

export const getAdminSystemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({}))
  .handler(async ({ context }): Promise<AdminSystemStatus> => {
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

    const countFromResult = (result: AdminCountResult, metric: string) => {
      if (result.error) {
        console.error(`[admin-stats] Unable to load ${metric}.`, result.error);
        throw new Error("System status could not be loaded.");
      }
      if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) {
        console.error(`[admin-stats] The ${metric} aggregate response was invalid.`, result.count);
        throw new Error("System status could not be loaded.");
      }
      return result.count;
    };

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const database = supabaseAdmin as unknown as AdminSystemStatusDatabase;
      const now = Date.now();
      const heldSince = new Date(now - TICKET_HOLD_DURATION_MS).toISOString();
      const emailSince = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [heldTickets, sentEmails, failedEmails] = await Promise.all([
        database
          .from("ticket")
          .select("id", { count: "exact", head: true })
          .eq("ticket_status", "pending")
          .gt("created_at", heldSince),
        database
          .from("eticket_email_log")
          .select("id", { count: "exact", head: true })
          .eq("status", "sent")
          .gt("created_at", emailSince),
        database
          .from("eticket_email_log")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gt("created_at", emailSince),
      ]);

      return {
        activeHeldTicketCount: countFromResult(heldTickets, "active held tickets"),
        emailsSent30DayCount: countFromResult(sentEmails, "sent e-ticket email count"),
        emailsFailed30DayCount: countFromResult(failedEmails, "failed e-ticket email count"),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "System status could not be loaded.") {
        throw error;
      }
      console.error("[admin-stats] Admin system status request failed.", error);
      throw new Error("System status could not be loaded.");
    }
  });
