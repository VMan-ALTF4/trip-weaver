import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import qrcode from "qrcode-generator";

const EMAIL_LOG_COLUMNS = "id, order_id, to_email, status, provider_message_id, error, created_at";
const EMAIL_PROVIDER_URL = "https://api.resend.com/emails";

interface EmailLogStatus {
  queued: "queued";
  sent: "sent";
  failed: "failed";
}

interface OrderTicketRow {
  id: string;
  order_id: string;
  user_id: string;
  tour_id: string;
  travel_date: string | null;
  pickup_location: string | null;
  seat_numbers: string[] | null;
}

interface OrderProfileRow {
  id: string;
  name?: string | null;
}

interface EticketEmailRow {
  id: string;
  ticket_id: string;
  ticket_code: string;
  tour_name: string;
  travel_date: string;
  pickup_location: string | null;
  pickup_time: string | null;
  seat_no: string | null;
  holder_name: string | null;
  expires_at: string;
}

interface EmailAttachment {
  filename: string;
  content: string;
}

interface EmailLogRow {
  id: string;
  order_id: string;
  to_email: string;
  status: "queued" | "sent" | "failed";
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
}

interface DatabaseResult {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

interface EmailLogQuery extends PromiseLike<DatabaseResult> {
  eq(column: "order_id" | "to_email" | "id", value: string): EmailLogQuery;
  gte(column: "created_at", value: string): EmailLogQuery;
  order(column: "created_at", options: { ascending: boolean }): EmailLogQuery;
  limit(count: number): EmailLogQuery;
  maybeSingle(): PromiseLike<DatabaseResult>;
  select(columns: string, options?: { count?: "exact"; head?: boolean }): PromiseLike<DatabaseResult>;
}

interface EmailLogMutationQuery extends PromiseLike<DatabaseResult> {
  eq(column: "id", value: string): EmailLogMutationQuery;
  insert(values: Record<string, unknown>): PromiseLike<DatabaseResult>;
  update(values: Record<string, unknown>): EmailLogMutationQuery;
  select(columns: string): PromiseLike<DatabaseResult>;
}

interface TicketEmailDatabase {
  from(table: "ticket" | "profiles" | "Tour" | "eticket" | "eticket_email_log"): {
    select(columns: string): PromiseLike<DatabaseResult> & {
      eq(column: string, value: string): ReturnType<this["select"]>;
      in(column: string, values: string[]): ReturnType<this["select"]>;
      gte(column: string, value: string): ReturnType<this["select"]>;
      limit(count: number): ReturnType<this["select"]>;
      order(column: string, options: { ascending: boolean }): ReturnType<this["select"]>;
      maybeSingle(): PromiseLike<DatabaseResult>;
      select(columns: string, options?: { count?: "exact"; head?: boolean }): PromiseLike<DatabaseResult>;
    };
    insert(values: Record<string, unknown>): PromiseLike<DatabaseResult>;
    update(values: Record<string, unknown>): { eq(column: string, value: string | boolean | null): { select(columns: string): PromiseLike<DatabaseResult> } };
  };
}

function isDatabaseResult(value: unknown): value is DatabaseResult {
  return typeof value === "object" && value !== null && "data" in value && "error" in value;
}

function getEnvironment(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function getRequiredEnvironment(name: string): string {
  const value = getEnvironment(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").slice(0, 64) || "ticket";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTicketDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(date);
}

function buildOrderViewUrl(orderId: string): string {
  const appUrl = (getEnvironment("APP_URL") ?? getEnvironment("PUBLIC_URL") ?? getEnvironment("SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  return `${appUrl}/eticket/${encodeURIComponent(orderId)}`;
}

function buildPlainTextEmail(tickets: EticketEmailRow[], recipientName: string, orderUrl: string): string {
  const lines = [
    `Xin chào ${recipientName},`,
    "",
    "TAT Booking đã phát hành e-ticket cho đơn của bạn.",
    "",
    ...tickets.map((ticket) => `- ${ticket.ticket_code} · ${ticket.tour_name} · ${ticket.travel_date} · ghế ${ticket.seat_no ?? "—"}`),
    "",
    `Xem vé: ${orderUrl}`,
    "",
    "Lưu ý: mang mã QR kèm theo khi lên xe và vào điểm tham quan. Mỗi QR chỉ dùng một lần cho từng phần của vé.",
    "",
    "Trân trọng,",
    "TAT Booking",
  ];
  return lines.join("\n");
}

function buildHtmlEmail(tickets: EticketEmailRow[], recipientName: string, orderUrl: string): string {
  const ticketRows = tickets
    .map(
      (ticket) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #0f172a;">${escapeHtml(ticket.ticket_code)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #0f172a;">${escapeHtml(ticket.tour_name)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #0f172a;">${escapeHtml(formatTicketDate(ticket.travel_date))}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #0f172a;">${escapeHtml(ticket.seat_no ?? "—")}</td>
      </tr>`,
    )
    .join("");

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
      <div style="max-width: 640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; overflow:hidden;">
        <div style="background: linear-gradient(135deg, #0f766e, #0284c7); color:#ffffff; padding:24px;">
          <h1 style="margin:0; font-size: 28px;">E-ticket đã sẵn sàng</h1>
          <p style="margin: 10px 0 0; font-size: 15px; opacity: 0.9;">Xin chào ${escapeHtml(recipientName)}, đơn đặt chỗ của bạn đã được phát hành.</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 15px; line-height: 1.6; margin:0 0 16px;">Vé điện tử của bạn đã được phát hành thành công. Vui lòng mang mã QR kèm theo khi lên xe và vào điểm tham quan.</p>
          <div style="display:block; margin: 18px 0 20px; text-align:center;">
            <a href="${escapeHtml(orderUrl)}" style="display:inline-block; background:#0f766e; color:#ffffff; text-decoration:none; border-radius:999px; padding:12px 18px; font-weight:700;">Xem vé</a>
          </div>
          <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:10px 12px; background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#475569;">Mã vé</th>
                <th style="text-align:left; padding:10px 12px; background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#475569;">Tour</th>
                <th style="text-align:left; padding:10px 12px; background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#475569;">Ngày</th>
                <th style="text-align:left; padding:10px 12px; background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#475569;">Ghế</th>
              </tr>
            </thead>
            <tbody>${ticketRows}</tbody>
          </table>
          <p style="margin-top: 18px; font-size: 14px; color: #475569; line-height: 1.6;">Lưu ý: mỗi QR chỉ dùng cho từng phần của vé; quét lại hoặc sử dụng không đúng mục đích sẽ bị từ chối.</p>
        </div>
        <div style="padding: 0 24px 24px; color:#475569; font-size:12px;">Trân trọng,<br/>TAT Booking</div>
      </div>
    </div>
  `;
}

function isOrderTicketRows(value: unknown): value is OrderTicketRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const item = row as Record<string, unknown>;
    return (
      typeof item["id"] === "string" &&
      typeof item["order_id"] === "string" &&
      typeof item["user_id"] === "string" &&
      typeof item["tour_id"] === "string" &&
      (typeof item["travel_date"] === "string" || item["travel_date"] === null) &&
      (typeof item["pickup_location"] === "string" || item["pickup_location"] === null) &&
      (Array.isArray(item["seat_numbers"]) || item["seat_numbers"] === null)
    );
  });
}

function isOrderProfileRows(value: unknown): value is OrderProfileRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const item = row as Record<string, unknown>;
    return (
      typeof item["id"] === "string" &&
      (typeof item["name"] === "string" || item["name"] === null)
    );
  });
}

function isEticketEmailRows(value: unknown): value is EticketEmailRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const item = row as Record<string, unknown>;
    return (
      typeof item["id"] === "string" &&
      typeof item["ticket_id"] === "string" &&
      typeof item["ticket_code"] === "string" &&
      typeof item["tour_name"] === "string" &&
      typeof item["travel_date"] === "string" &&
      (typeof item["pickup_location"] === "string" || item["pickup_location"] === null) &&
      (typeof item["pickup_time"] === "string" || item["pickup_time"] === null) &&
      (typeof item["seat_no"] === "string" || item["seat_no"] === null) &&
      (typeof item["holder_name"] === "string" || item["holder_name"] === null) &&
      typeof item["expires_at"] === "string"
    );
  });
}

function isEmailLogRows(value: unknown): value is EmailLogRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const item = row as Record<string, unknown>;
    return (
      typeof item["id"] === "string" &&
      typeof item["order_id"] === "string" &&
      typeof item["to_email"] === "string" &&
      (item["status"] === "queued" || item["status"] === "sent" || item["status"] === "failed") &&
      (typeof item["provider_message_id"] === "string" || item["provider_message_id"] === null) &&
      (typeof item["error"] === "string" || item["error"] === null) &&
      typeof item["created_at"] === "string"
    );
  });
}

function buildQrPngAttachment(token: string, ticketCode: string): EmailAttachment {
  const generator = qrcode(0, "M");
  generator.addData(token, "Byte");
  generator.make();
  const createDataUrl = (generator as { createDataURL?: (cellSize: number, margin: number) => string }).createDataURL;
  if (typeof createDataUrl !== "function") {
    throw new Error("QR PNG generation is not available in the current runtime.");
  }

  const dataUrl = createDataUrl(4, 0);
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match || !match[1]) {
    throw new Error("The QR generator did not return a PNG data URL.");
  }

  return {
    filename: `${sanitizeForFilename(ticketCode)}.png`,
    content: match[1],
  };
}

async function insertEmailLog(database: TicketEmailDatabase, orderId: string, toEmail: string): Promise<EmailLogRow> {
  const { data, error } = await database
    .from("eticket_email_log")
    .insert({ order_id: orderId, to_email: toEmail, status: "queued", provider_message_id: null, error: null })
    .select(EMAIL_LOG_COLUMNS) as PromiseLike<DatabaseResult>;

  if (error) {
    throw new Error(`Unable to log the e-ticket email attempt: ${error.message}`);
  }
  if (!isEmailLogRows(data)) {
    throw new Error("The e-ticket email log returned an unexpected result.");
  }
  return data[0];
}

async function updateEmailLog(
  database: TicketEmailDatabase,
  logId: string,
  update: { status: "sent" | "failed"; provider_message_id?: string | null; error?: string | null },
): Promise<void> {
  const { data, error } = await database
    .from("eticket_email_log")
    .update(update)
    .eq("id", logId)
    .select(EMAIL_LOG_COLUMNS) as PromiseLike<DatabaseResult>;

  if (error) {
    throw new Error(`Unable to save the e-ticket email log transition: ${error.message}`);
  }
  if (data !== null && !isEmailLogRows(data)) {
    throw new Error("The e-ticket email log update returned invalid data.");
  }
}

async function getOrderEmailSummary(orderId: string): Promise<{ recipientEmail: string; recipientName: string; ticketRows: EticketEmailRow[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const database = supabaseAdmin as unknown as TicketEmailDatabase;

  const { data: ticketRows, error: ticketError } = await database
    .from("ticket")
    .select("id, order_id, user_id, tour_id, travel_date, pickup_location, seat_numbers")
    .eq("order_id", orderId)
    .eq("ticket_status", "sold");
  if (ticketError) throw new Error(`Unable to load the order tickets: ${ticketError.message}`);
  if (!isOrderTicketRows(ticketRows) || ticketRows.length === 0) {
    throw new Error("No sold tickets were found for this order.");
  }

  const profileIds = [...new Set(ticketRows.map((row) => row.user_id))];
  if (profileIds.length !== 1 || !profileIds[0]) {
    throw new Error("The order does not have a single ticket owner.");
  }
  const { data: profiles, error: profileError } = await database
    .from("profiles")
    .select("id, name")
    .in("id", profileIds);
  if (profileError) throw new Error(`Unable to load the order profile: ${profileError.message}`);
  if (!isOrderProfileRows(profiles)) {
    throw new Error("The order profile data is invalid.");
  }

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const recipientProfile = profileMap.get(profileIds[0]);
  if (!recipientProfile) throw new Error("No profile is available for this order.");
  const {
    data: { user: recipientUser },
    error: recipientError,
  } = await supabaseAdmin.auth.admin.getUserById(profileIds[0]);
  if (recipientError) throw new Error(`Unable to load the account email: ${recipientError.message}`);
  if (!recipientUser?.email) throw new Error("No account email is available for this order.");

  const ticketIds = ticketRows.map((row) => row.id);
  const { data: etickets, error: eticketError } = await database
    .from("eticket")
    .select("id, ticket_id, ticket_code, tour_name, travel_date, pickup_location, pickup_time, seat_no, holder_name, expires_at")
    .in("ticket_id", ticketIds);
  if (eticketError) throw new Error(`Unable to load the order e-tickets: ${eticketError.message}`);
  if (!isEticketEmailRows(etickets)) {
    throw new Error("The order's e-ticket rows are invalid.");
  }

  const byTicketId = new Map(etickets.map((row) => [row.ticket_id, row]));
  const ticketRowsForEmail = ticketRows.map((ticket) => {
    const eticket = byTicketId.get(ticket.id);
    return {
      ...eticket!,
      travel_date: eticket?.travel_date ?? ticket.travel_date ?? new Date().toISOString(),
      seat_no: eticket?.seat_no ?? (ticket.seat_numbers?.[0] ?? null),
      pickup_location: eticket?.pickup_location ?? ticket.pickup_location,
      tour_name: eticket?.tour_name ?? "Tour booking",
    } satisfies EticketEmailRow;
  });

  return {
    recipientEmail: recipientUser.email,
    recipientName: recipientProfile.name ?? "traveller",
    ticketRows: ticketRowsForEmail,
  };
}

async function assertOrderOwner(orderId: string, userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const database = supabaseAdmin as unknown as TicketEmailDatabase;
  const { data, error } = await database
    .from("ticket")
    .select("user_id")
    .eq("order_id", orderId)
    .limit(1);

  if (error) throw new Error(`Unable to verify the e-ticket order owner: ${error.message}`);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("This order is not accessible.");
  }

  const rows = data as Array<{ user_id: string }>;
  if (!rows.every((row) => row.user_id === userId)) {
    throw new Error("You do not have access to this order.");
  }
}

async function getEmailLogCount(database: TicketEmailDatabase, orderId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await database
    .from("eticket_email_log")
    .select("*", { count: "exact", head: true })
    .eq("order_id", orderId)
    .gte("created_at", oneHourAgo) as PromiseLike<DatabaseResult>;

  if (error) {
    throw new Error(`Unable to count recent e-ticket emails: ${error.message}`);
  }
  return typeof count === "number" ? count : 0;
}

export async function sendOrderEticketEmail(
  orderId: string,
  options: { force?: boolean; requestedByUserId?: string | null } = {},
): Promise<{ status: "sent" | "failed" | "skipped"; message: string; attempts: number }> {
  if (!orderId.trim()) {
    throw new Error("An order ID is required to send an e-ticket email.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const database = supabaseAdmin as unknown as TicketEmailDatabase;

  if (options.requestedByUserId) {
    await assertOrderOwner(orderId, options.requestedByUserId);
  }

  const { recipientEmail, recipientName, ticketRows } = await getOrderEmailSummary(orderId);
  const orderUrl = buildOrderViewUrl(orderId);
  const recentAttempts = await getEmailLogCount(database, orderId);
  const existingLogs = await database
    .from("eticket_email_log")
    .select(EMAIL_LOG_COLUMNS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1) as PromiseLike<DatabaseResult>;

  if (errorFromResult(existingLogs) && !options.force) {
    throw new Error(`Unable to read the e-ticket email log: ${errorFromResult(existingLogs)!.message}`);
  }
  if (!options.force && recentAttempts >= 3) {
    return {
      status: "skipped",
      message: "The hourly resend limit for this order has been reached.",
      attempts: recentAttempts,
    };
  }

  const logData = isEmailLogRows((existingLogs as DatabaseResult).data)
    ? (existingLogs as DatabaseResult).data
    : [];
  const latestLog = logData[0];
  if (!options.force && latestLog && latestLog.status === "sent") {
    return {
      status: "skipped",
      message: "An e-ticket email has already been sent for this order.",
      attempts: recentAttempts,
    };
  }

  const emailApiKey = getRequiredEnvironment("RESEND_API_KEY");
  const fromEmail = getEnvironment("RESEND_FROM_EMAIL") ?? "TAT Booking <noreply@trip-weaver.app>";
  const emailHtml = buildHtmlEmail(ticketRows, recipientName, orderUrl);
  const emailText = buildPlainTextEmail(ticketRows, recipientName, orderUrl);

  const log = await insertEmailLog(database, orderId, recipientEmail);
  try {
    const attachments = await Promise.all(
      ticketRows.map(async (ticket) => {
        const { signEticketToken } = await import("@/lib/eticket-token.server");
        const { createEticketQrSvg } = await import("@/lib/eticket-qr.server");
        const token = await signEticketToken(ticket.id);
        void createEticketQrSvg(token);
        return buildQrPngAttachment(token, ticket.ticket_code);
      }),
    );

    const response = await fetch(EMAIL_PROVIDER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: `Your TAT e-ticket for ${ticketRows[0]?.tour_name ?? "your trip"}`,
        html: emailHtml,
        text: emailText,
        attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
        })),
      }),
    });

    const payload = (await response.json()) as { id?: string; error?: { message?: string } };
    if (!response.ok) {
      const shortError = payload?.error?.message ?? "The email provider rejected the request.";
      await updateEmailLog(database, log.id, {
        status: "failed",
        error: shortError.slice(0, 180),
      });
      return {
        status: "failed",
        message: "E-ticket email delivery failed.",
        attempts: recentAttempts + 1,
      };
    }

    await updateEmailLog(database, log.id, {
      status: "sent",
      provider_message_id: payload.id ?? null,
      error: null,
    });
    return {
      status: "sent",
      message: "The e-ticket email was sent successfully.",
      attempts: recentAttempts + 1,
    };
  } catch (error) {
    const shortError = error instanceof Error ? error.message : "Unknown email delivery error.";
    await updateEmailLog(database, log.id, {
      status: "failed",
      error: shortError.slice(0, 180),
    });

    return {
      status: "failed",
      message: "E-ticket email delivery failed.",
      attempts: recentAttempts + 1,
    };
  }
}

function errorFromResult(result: PromiseLike<DatabaseResult> | DatabaseResult | undefined): { message: string } | null {
  if (!result) return null;
  if (typeof result === "object" && "error" in result && result.error && typeof result.error === "object") {
    return result.error as { message: string };
  }
  return null;
}

export const resendEticketEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      orderId: z.string().uuid(),
      force: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ data, context }) => {
    const result = await sendOrderEticketEmail(data.orderId, {
      force: data.force,
      requestedByUserId: context.userId,
    });
    return result;
  });
