import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhoneToE164 } from "@/lib/booking-profile";

const paymentRequestSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(["vnpay", "momo", "card", "bank_transfer", "paypal"]),
});

type PaymentRpcResult = {
  result: "paid" | "already_paid" | "expired" | "conflict" | "not_found" | "forbidden";
  ticket_count: number;
  total_price: number | string;
  ticket_issue_status: "pending_issue" | "issued" | null;
};

type CloseOrderResult = {
  result: "cancelled" | "expired" | "pending" | "conflict" | "not_found" | "forbidden";
};

function isCloseOrderResult(value: unknown): value is CloseOrderResult {
  if (typeof value !== "object" || value === null) return false;
  const result = (value as Record<string, unknown>)["result"];
  return (
    result === "cancelled" ||
    result === "expired" ||
    result === "pending" ||
    result === "conflict" ||
    result === "not_found" ||
    result === "forbidden"
  );
}

function isPaymentRpcResult(value: unknown): value is PaymentRpcResult {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  const result = row["result"];
  const ticketCount = row["ticket_count"];
  const totalPrice = row["total_price"];
  return (
    (result === "paid" ||
      result === "already_paid" ||
      result === "expired" ||
      result === "conflict" ||
      result === "not_found" ||
      result === "forbidden") &&
    typeof ticketCount === "number" &&
    ticketCount >= 0 &&
    (typeof totalPrice === "number" || typeof totalPrice === "string") &&
    Number.isFinite(Number(totalPrice)) &&
    (row["ticket_issue_status"] === null ||
      row["ticket_issue_status"] === "pending_issue" ||
      row["ticket_issue_status"] === "issued")
  );
}

export const confirmTicketPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(paymentRequestSchema)
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, { issueTickets }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/tickets.server"),
    ]);

    const adminClient = supabaseAdmin as unknown as SupabaseClient;
    const { data: orderTickets, error: ticketsError } = await adminClient
      .from("ticket")
      .select("user_id, ticket_status")
      .eq("order_id", data.orderId);

    if (ticketsError) {
      console.error("Unable to inspect ticket order before payment.");
      throw new Error("Payment could not be confirmed. Please try again or contact support.");
    }

    const ownedOrderTickets = orderTickets ?? [];
    const orderBelongsToUser =
      ownedOrderTickets.length > 0 &&
      ownedOrderTickets.every((ticket) => ticket.user_id === context.userId);
    const orderAlreadySold =
      orderBelongsToUser &&
      ownedOrderTickets.every((ticket) => ticket.ticket_status === "sold");
    const orderHasPendingTickets =
      orderBelongsToUser &&
      ownedOrderTickets.some((ticket) => ticket.ticket_status === "pending");

    if (orderHasPendingTickets && !orderAlreadySold) {
      const [
        { data: profile, error: profileError },
        { data: authUserData, error: authUserError },
      ] = await Promise.all([
        adminClient
          .from("profiles")
          .select("sdt")
          .eq("id", context.userId)
          .maybeSingle(),
        adminClient.auth.admin.getUserById(context.userId),
      ]);

      if (profileError || authUserError) {
        console.error("Unable to verify booking profile before payment.");
        throw new Error("Payment could not be confirmed. Please try again or contact support.");
      }

      if (
        !normalizePhoneToE164(profile?.sdt) ||
        !authUserData.user?.email_confirmed_at ||
        authUserData.user.new_email
      ) {
        throw new Error("PROFILE_INCOMPLETE");
      }
    }

    const { data: rpcData, error } = await adminClient.rpc("confirm_ticket_payment", {
      p_order_id: data.orderId,
      p_user_id: context.userId,
      p_payment_method: data.paymentMethod,
    });

    if (error) {
      console.error("Unable to confirm ticket payment.");
      throw new Error("Payment could not be confirmed. Please try again or contact support.");
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : null;
    if (!isPaymentRpcResult(row)) {
      throw new Error("The payment service returned an invalid response.");
    }

    switch (row.result) {
      case "not_found":
        throw new Error("This booking could not be found.");
      case "forbidden":
        throw new Error("You are not allowed to pay for this booking.");
      case "conflict":
        throw new Error("The tickets have different statuses or do not belong to one order.");
      case "expired":
        return { status: "expired" as const };
      case "already_paid": {
        let ticketIssueStatus: TicketIssueResult =
          row.ticket_issue_status === "issued" ? "issued" : "pending_issue";
        if (ticketIssueStatus === "pending_issue") {
          try {
            ticketIssueStatus = await issueTickets(data.orderId);
          } catch {
            console.error("Ticket issuance is pending and must be retried.");
          }
        }
        return {
          status: "paid" as const,
          alreadyPaid: true,
          ticketIssueStatus,
          total: Number(row.total_price),
        };
      }
      case "paid": {
        let ticketIssueStatus: TicketIssueResult = "pending_issue";
        try {
          ticketIssueStatus = await issueTickets(data.orderId);
        } catch {
          console.error("Ticket issuance is pending and must be retried.");
        }

        return {
          status: "paid" as const,
          alreadyPaid: false,
          ticketIssueStatus,
          total: Number(row.total_price),
        };
      }
    }
  });

const closeOrderSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["cancelled", "expired"]),
});

export const closeTicketOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(closeOrderSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminClient = supabaseAdmin as unknown as SupabaseClient;
    const { data: rpcData, error } = await adminClient.rpc("close_ticket_order", {
      p_order_id: data.orderId,
      p_user_id: context.userId,
      p_status: data.status,
    });

    if (error) {
      console.error("Unable to close ticket order.");
      throw new Error("The booking could not be updated. Please try again or contact support.");
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : null;
    if (!isCloseOrderResult(row)) {
      throw new Error("The booking service returned an invalid response.");
    }

    if (row.result === "forbidden") {
      throw new Error("You are not allowed to update this booking.");
    }
    if (row.result === "not_found") {
      throw new Error("This booking could not be found.");
    }
    if (row.result === "conflict") {
      throw new Error("The tickets have different statuses. Review your bookings.");
    }

    return { status: row.result };
  });

export type TicketIssueResult = "pending_issue" | "issued";
