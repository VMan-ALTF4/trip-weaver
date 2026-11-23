import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Eticket } from "@/lib/eticket-types";

type EticketRpcClient = {
  rpc: (
    functionName: "issue_eticket_for_ticket",
    args: { ticket_id: string },
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

function isEticket(value: unknown): value is Eticket {
  if (typeof value !== "object" || value === null) return false;

  const row = value as Record<string, unknown>;
  return (
    typeof row["id"] === "string" &&
    typeof row["ticket_id"] === "string" &&
    typeof row["user_id"] === "string" &&
    typeof row["ticket_code"] === "string" &&
    /^TAT-[A-HJ-NP-Z2-9]{6}$/.test(row["ticket_code"]) &&
    (row["status"] === "valid" || row["status"] === "cancelled" || row["status"] === "expired") &&
    typeof row["tour_name"] === "string" &&
    typeof row["travel_date"] === "string" &&
    (typeof row["pickup_location"] === "string" || row["pickup_location"] === null) &&
    (typeof row["pickup_time"] === "string" || row["pickup_time"] === null) &&
    (typeof row["seat_no"] === "string" || row["seat_no"] === null) &&
    (typeof row["holder_name"] === "string" || row["holder_name"] === null) &&
    typeof row["expires_at"] === "string" &&
    (typeof row["qr_jti"] === "string" || row["qr_jti"] === null) &&
    (typeof row["qr_issued_at"] === "string" || row["qr_issued_at"] === null) &&
    (typeof row["qr_key_id"] === "string" || row["qr_key_id"] === null) &&
    typeof row["created_at"] === "string"
  );
}

export async function createEticketForTicket(ticketId: string): Promise<Eticket> {
  if (!ticketId.trim()) {
    throw new Error("A ticket ID is required to issue an e-ticket.");
  }

  // Generated Supabase types omit this new RPC; validate its response at this boundary.
  const client = supabaseAdmin as unknown as EticketRpcClient;
  const { data, error } = await client.rpc("issue_eticket_for_ticket", {
    ticket_id: ticketId,
  });

  if (error) {
    throw new Error(`Failed to issue e-ticket for ticket ${ticketId}: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(`The e-ticket RPC returned an unexpected result for ticket ${ticketId}.`);
  }

  const row: unknown = data[0];
  if (!isEticket(row)) {
    throw new Error(`The e-ticket RPC returned an invalid e-ticket for ticket ${ticketId}.`);
  }

  const { ensureEticketQrMetadata } = await import("@/lib/eticket-token.server");
  const qrMetadata = await ensureEticketQrMetadata(row.id);

  return { ...row, ...qrMetadata };
}
