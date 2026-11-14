export type TicketIssueResult = "pending_issue" | "issued";

interface TicketRow {
  id: string;
}

interface DatabaseResult {
  data: unknown;
  error: { message: string } | null;
}

interface TicketSelectQuery extends PromiseLike<DatabaseResult> {
  eq(column: "order_id" | "ticket_status", value: string): TicketSelectQuery;
}

interface TicketUpdateQuery extends PromiseLike<DatabaseResult> {
  eq(column: "order_id" | "ticket_status", value: string): TicketUpdateQuery;
}

interface TicketIssueDatabase {
  from(table: "ticket"): {
    select(columns: "id"): TicketSelectQuery;
    update(values: { ticket_issue_status: TicketIssueResult }): TicketUpdateQuery;
  };
}

function isTicketRows(value: unknown): value is TicketRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) => typeof row === "object" && row !== null && "id" in row && typeof row.id === "string",
    )
  );
}

async function updateIssueStatus(
  database: TicketIssueDatabase,
  orderId: string,
  status: TicketIssueResult,
): Promise<void> {
  const { error } = await database
    .from("ticket")
    .update({ ticket_issue_status: status })
    .eq("order_id", orderId)
    .eq("ticket_status", "sold");
  if (error) {
    console.error("Unable to update ticket issuance status.");
    throw new Error("Ticket issuance status could not be updated.");
  }
}

export async function issueTickets(orderId: string): Promise<TicketIssueResult> {
  if (!orderId.trim()) throw new Error("An order ID is required to issue tickets.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createEticketForTicket } = await import("@/lib/eticket.server");
  const { signEticketToken } = await import("@/lib/eticket-token.server");
  const { createEticketQrSvg } = await import("@/lib/eticket-qr.server");
  const database = supabaseAdmin as unknown as TicketIssueDatabase;
  const { data, error } = await database
    .from("ticket")
    .select("id")
    .eq("order_id", orderId)
    .eq("ticket_status", "sold");

  if (error) {
    console.error("Unable to load sold tickets for issuance.");
    throw new Error("Tickets could not be issued.");
  }
  if (!isTicketRows(data) || data.length === 0) {
    throw new Error("No sold tickets were found for this order.");
  }

  try {
    for (const ticket of data) {
      const eticket = await createEticketForTicket(ticket.id);
      const token = await signEticketToken(eticket.id);
      createEticketQrSvg(token);
    }
    await updateIssueStatus(database, orderId, "issued");

    try {
      const { sendOrderEticketEmail } = await import("@/lib/email.server");
      await sendOrderEticketEmail(orderId);
    } catch (emailError) {
      console.error("E-ticket email send skipped after issuance because the provider failed.", emailError);
    }

    return "issued";
  } catch (error) {
    try {
      await updateIssueStatus(database, orderId, "pending_issue");
    } catch {
      console.error("Ticket issuance failed and its retry status could not be saved.");
      throw new Error("Ticket issuance failed and must be retried.");
    }
    throw error;
  }
}
