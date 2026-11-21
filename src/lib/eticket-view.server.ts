import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderEticketSchema = z.object({ orderId: z.string().uuid() });

export type EticketViewStatus = "valid" | "cancelled" | "expired";
export type EticketSegmentViewStatus = "unused" | "used" | "cancelled";
export type EticketViewErrorCode =
  | "not_authenticated"
  | "forbidden"
  | "not_found"
  | "not_issued"
  | "processing"
  | "system";

export class EticketViewError extends Error {
  code: EticketViewErrorCode;

  constructor(code: EticketViewErrorCode, message: string) {
    super(message);
    this.name = "EticketViewError";
    this.code = code;
  }
}

interface TicketRow {
  id: string;
  order_id: string;
  tour_id: string;
  user_id: string;
  ticket_status: "pending" | "sold" | "expired" | "cancelled";
  ticket_issue_status: "pending_issue" | "issued" | null;
  travel_date: string | null;
  pickup_location: string | null;
  pickup_time: string | null;
  seat_numbers: string[] | null;
  price: number;
  created_at: string;
}

type TicketTransport = "bus" | "car" | "train";

interface TourTransportRow {
  tour_id: string | number;
  transport: TicketTransport;
}

interface EticketRow {
  id: string;
  ticket_id: string;
  user_id: string;
  ticket_code: string;
  status: EticketViewStatus;
  tour_name: string;
  travel_date: string;
  pickup_location: string | null;
  pickup_time: string | null;
  seat_no: string | null;
  holder_name: string | null;
  expires_at: string;
  created_at: string;
}

interface EticketSegmentRow {
  id: string;
  eticket_id: string;
  kind: "transport" | "attraction";
  label: string | null;
  position: number;
  status: EticketSegmentViewStatus;
  used_at: string | null;
  scanned_by: string | null;
  created_at: string;
}

interface DatabaseResult {
  data: unknown;
  error: { message: string } | null;
}

interface TicketQuery extends PromiseLike<DatabaseResult> {
  eq(column: "order_id" | "user_id" | "ticket_status" | "id", value: string): TicketQuery;
  in(column: "id", values: string[]): TicketQuery;
  order(column: "created_at", options: { ascending: boolean }): TicketQuery;
}

interface TourQuery extends PromiseLike<DatabaseResult> {
  in(column: "tour_id", values: string[]): TourQuery;
}

interface EticketQuery extends PromiseLike<DatabaseResult> {
  eq(column: "ticket_id" | "id", value: string): EticketQuery;
  in(column: "ticket_id", values: string[]): EticketQuery;
}

interface EticketSegmentQuery extends PromiseLike<DatabaseResult> {
  in(column: "eticket_id", values: string[]): EticketSegmentQuery;
}

interface TicketDatabase {
  from(table: "ticket"): {
    select(columns: string): TicketQuery;
  };
  from(table: "Tour"): {
    select(columns: string): TourQuery;
  };
  from(table: "eticket"): {
    select(columns: string): EticketQuery;
  };
  from(table: "eticket_segment"): {
    select(columns: string): EticketSegmentQuery;
  };
}

function isTicketTransport(value: unknown): value is TicketTransport {
  return value === "bus" || value === "car" || value === "train";
}

function isTicketRows(value: unknown): value is TicketRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const item = row as Record<string, unknown>;
    return (
      typeof item["id"] === "string" &&
      typeof item["order_id"] === "string" &&
      typeof item["tour_id"] === "string" &&
      typeof item["user_id"] === "string" &&
      (item["ticket_status"] === "pending" || item["ticket_status"] === "sold" || item["ticket_status"] === "expired" || item["ticket_status"] === "cancelled") &&
      (item["ticket_issue_status"] === null || item["ticket_issue_status"] === "pending_issue" || item["ticket_issue_status"] === "issued") &&
      (typeof item["travel_date"] === "string" || item["travel_date"] === null) &&
      (typeof item["pickup_location"] === "string" || item["pickup_location"] === null) &&
      (typeof item["pickup_time"] === "string" || item["pickup_time"] === null) &&
      (Array.isArray(item["seat_numbers"]) || item["seat_numbers"] === null) &&
      typeof item["price"] === "number" &&
      typeof item["created_at"] === "string"
    );
  });
}

function isTourTransportRows(value: unknown): value is TourTransportRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const item = row as Record<string, unknown>;
    return (
      (typeof item["tour_id"] === "string" || (typeof item["tour_id"] === "number" && Number.isFinite(item["tour_id"]))) &&
      isTicketTransport(item["transport"])
    );
  });
}

function isEticketRows(value: unknown): value is EticketRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const item = row as Record<string, unknown>;
    return (
      typeof item["id"] === "string" &&
      typeof item["ticket_id"] === "string" &&
      typeof item["user_id"] === "string" &&
      typeof item["ticket_code"] === "string" &&
      (item["status"] === "valid" || item["status"] === "cancelled" || item["status"] === "expired") &&
      typeof item["tour_name"] === "string" &&
      typeof item["travel_date"] === "string" &&
      (typeof item["pickup_location"] === "string" || item["pickup_location"] === null) &&
      (typeof item["pickup_time"] === "string" || item["pickup_time"] === null) &&
      (typeof item["seat_no"] === "string" || item["seat_no"] === null) &&
      (typeof item["holder_name"] === "string" || item["holder_name"] === null) &&
      typeof item["expires_at"] === "string" &&
      typeof item["created_at"] === "string"
    );
  });
}

function isEticketSegmentRows(value: unknown): value is EticketSegmentRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const item = row as Record<string, unknown>;
    return (
      typeof item["id"] === "string" &&
      typeof item["eticket_id"] === "string" &&
      (item["kind"] === "transport" || item["kind"] === "attraction") &&
      (typeof item["label"] === "string" || item["label"] === null) &&
      typeof item["position"] === "number" &&
      (item["status"] === "unused" || item["status"] === "used" || item["status"] === "cancelled") &&
      (typeof item["used_at"] === "string" || item["used_at"] === null) &&
      (typeof item["scanned_by"] === "string" || item["scanned_by"] === null) &&
      typeof item["created_at"] === "string"
    );
  });
}

export const getOrderEtickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(orderEticketSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signEticketToken } = await import("@/lib/eticket-token.server");
    const { createEticketQrSvg } = await import("@/lib/eticket-qr.server");

    if (!context?.userId) {
      throw new EticketViewError("not_authenticated", "Please sign in to view this e-ticket.");
    }

    const database = supabaseAdmin as unknown as TicketDatabase;
    const { data: ticketRows, error: ticketError } = await database
      .from("ticket")
      .select("id, order_id, tour_id, user_id, ticket_status, ticket_issue_status, travel_date, pickup_location, pickup_time, seat_numbers, price, created_at")
      .eq("order_id", data.orderId);

    if (ticketError) {
      console.error("[eticket-view] Unable to load order tickets.", {
        orderId: data.orderId,
        userId: context.userId,
        error: ticketError,
      });
      throw new EticketViewError("system", "The e-ticket could not be loaded due to a system error.");
    }

    if (!isTicketRows(ticketRows) || ticketRows.length === 0) {
      console.warn("[eticket-view] No tickets found for order.", {
        orderId: data.orderId,
        userId: context.userId,
      });
      throw new EticketViewError("not_found", "We could not find a booking for this order in your account.");
    }

    if (ticketRows.some((item) => item.user_id !== context.userId)) {
      console.warn("[eticket-view] Unauthorized e-ticket access attempt.", {
        orderId: data.orderId,
        requesterUserId: context.userId,
        ticketOwners: ticketRows.map((item) => item.user_id),
      });
      throw new EticketViewError("forbidden", "You do not have permission to view this e-ticket.");
    }

    const tourIds = [...new Set(ticketRows.map((ticket) => ticket.tour_id))];
    const { data: tourRows, error: tourError } = await database
      .from("Tour")
      .select("tour_id, transport")
      .in("tour_id", tourIds);

    if (tourError) {
      console.error("[eticket-view] Unable to load tour transport types.", {
        orderId: data.orderId,
        userId: context.userId,
        error: tourError,
      });
      throw new EticketViewError("system", "The e-ticket could not be loaded due to a system error.");
    }

    if (!isTourTransportRows(tourRows)) {
      console.error("[eticket-view] Invalid tour transport payload from database.", {
        orderId: data.orderId,
        userId: context.userId,
        rows: tourRows,
      });
      throw new EticketViewError("system", "The e-ticket data returned by the server was invalid.");
    }

    const transportByTourId = new Map(tourRows.map((tour) => [String(tour.tour_id), tour.transport]));
    if (tourIds.some((tourId) => !transportByTourId.has(tourId))) {
      console.error("[eticket-view] A booked tour has no transport type.", {
        orderId: data.orderId,
        userId: context.userId,
        tourIds,
      });
      throw new EticketViewError("system", "The e-ticket data returned by the server was incomplete.");
    }

    const soldTickets = ticketRows.filter((item) => item.ticket_status === "sold");
    if (soldTickets.some((item) => item.ticket_issue_status === "pending_issue")) {
      throw new EticketViewError("processing", "Your e-ticket is still being prepared. Please wait a moment and try again.");
    }

    let eticketRows: EticketRow[] = [];
    if (soldTickets.length > 0 || ticketRows.some((item) => item.ticket_issue_status === "issued")) {
      const ticketIds = ticketRows.map((item) => item.id);
      const { data: loadedEtickets, error: eticketError } = await database
        .from("eticket")
        .select("id, ticket_id, user_id, ticket_code, status, tour_name, travel_date, pickup_location, pickup_time, seat_no, holder_name, expires_at, created_at")
        .in("ticket_id", ticketIds);

      if (eticketError) {
        console.error("[eticket-view] Unable to load e-tickets for order.", {
          orderId: data.orderId,
          userId: context.userId,
          error: eticketError,
        });
        throw new EticketViewError("system", "The e-ticket could not be loaded due to a system error.");
      }

      if (!isEticketRows(loadedEtickets)) {
        console.error("[eticket-view] Invalid e-ticket payload from database.", {
          orderId: data.orderId,
          userId: context.userId,
          rows: loadedEtickets,
        });
        throw new EticketViewError("system", "The e-ticket data returned by the server was invalid.");
      }

      eticketRows = loadedEtickets;
    }

    if (soldTickets.length > 0 && eticketRows.length === 0) {
      try {
        const { issueTickets } = await import("@/lib/tickets.server");
        await issueTickets(data.orderId);
      } catch (issueError) {
        console.error("[eticket-view] Automatic e-ticket issuance failed for order.", {
          orderId: data.orderId,
          userId: context.userId,
          error: issueError,
        });
        throw new EticketViewError("not_issued", "This order does not have an e-ticket yet. Please retry issuance to generate it.");
      }

      const ticketIds = ticketRows.map((item) => item.id);
      const { data: reloadedEtickets, error: reloadError } = await database
        .from("eticket")
        .select("id, ticket_id, user_id, ticket_code, status, tour_name, travel_date, pickup_location, pickup_time, seat_no, holder_name, expires_at, created_at")
        .in("ticket_id", ticketIds);

      if (reloadError) {
        console.error("[eticket-view] Unable to reload e-tickets after issuance.", {
          orderId: data.orderId,
          userId: context.userId,
          error: reloadError,
        });
        throw new EticketViewError("system", "The e-ticket could not be loaded due to a system error.");
      }

      if (!isEticketRows(reloadedEtickets)) {
        console.error("[eticket-view] Invalid e-ticket rows after issuance retry.", {
          orderId: data.orderId,
          userId: context.userId,
          rows: reloadedEtickets,
        });
        throw new EticketViewError("system", "The e-ticket data returned by the server was invalid.");
      }

      eticketRows = reloadedEtickets;
    }

    if (soldTickets.length > 0 && eticketRows.length === 0) {
      throw new EticketViewError("not_issued", "This order has not issued an e-ticket yet. Please retry issuance.");
    }

    const eticketIds = eticketRows.map((row) => row.id);
    let segmentRows: EticketSegmentRow[] = [];
    if (eticketIds.length > 0) {
      const { data: segmentData, error: segmentError } = await database
        .from("eticket_segment")
        .select("id, eticket_id, kind, label, position, status, used_at, scanned_by, created_at")
        .in("eticket_id", eticketIds);

      if (segmentError) {
        console.error("[eticket-view] Unable to load e-ticket segments.", {
          orderId: data.orderId,
          userId: context.userId,
          error: segmentError,
        });
        throw new EticketViewError("system", "The e-ticket could not be loaded due to a system error.");
      }

      if (!isEticketSegmentRows(segmentData)) {
        console.error("[eticket-view] Invalid e-ticket segment payload from database.", {
          orderId: data.orderId,
          userId: context.userId,
          rows: segmentData,
        });
        throw new EticketViewError("system", "The e-ticket data returned by the server was invalid.");
      }
      segmentRows = segmentData;
    }

    const segmentsByEticketId = new Map<string, EticketSegmentRow[]>();
    for (const segment of segmentRows) {
      const list = segmentsByEticketId.get(segment.eticket_id) ?? [];
      list.push(segment);
      segmentsByEticketId.set(segment.eticket_id, list);
    }

    const eticketMap = new Map(eticketRows.map((row) => [row.ticket_id, row]));

    return {
      orderId: data.orderId,
      tickets: await Promise.all(
        ticketRows.map(async (ticket) => {
          const eticket = eticketMap.get(ticket.id) ?? null;
          const segments = eticket ? segmentsByEticketId.get(eticket.id) ?? [] : [];
          const qrSvg = eticket ? createEticketQrSvg(await signEticketToken(eticket.id)) : null;

          return {
            id: ticket.id,
            order_id: ticket.order_id,
            ticket_status: ticket.ticket_status,
            ticket_issue_status: ticket.ticket_issue_status,
            travel_date: ticket.travel_date,
            pickup_location: ticket.pickup_location,
            pickup_time: ticket.pickup_time,
            seat_numbers: ticket.seat_numbers ?? [],
            transport: transportByTourId.get(ticket.tour_id)!,
            price: ticket.price,
            created_at: ticket.created_at,
            eticket: eticket
              ? {
                  ...eticket,
                  qrSvg,
                }
              : null,
            segments,
          };
        }),
      ),
    };
  });
