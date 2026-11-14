import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  EticketSegmentKind,
  EticketSegmentStatus,
  EticketStatus,
} from "@/lib/eticket-types";
import type { EticketTokenClaims } from "@/lib/eticket-token.server";

const scanTokenSchema = z.object({
  token: z.string().trim().min(1).max(8192),
});

const scanSegmentSchema = scanTokenSchema.extend({
  segmentId: z.string().uuid(),
});

interface DatabaseResult {
  data: unknown;
  error: { message: string } | null;
}

interface EticketRow {
  id: string;
  ticket_code: string;
  status: EticketStatus;
  expires_at: string;
  qr_jti: string | null;
}

export interface EticketScanSegment {
  id: string;
  kind: EticketSegmentKind;
  label: string | null;
  position: number;
  status: EticketSegmentStatus;
}

interface EticketQuery extends PromiseLike<DatabaseResult> {
  eq(column: "id", value: string): EticketQuery;
  maybeSingle(): PromiseLike<DatabaseResult>;
}

interface SegmentQuery extends PromiseLike<DatabaseResult> {
  eq(column: "eticket_id" | "id", value: string): SegmentQuery;
  maybeSingle(): PromiseLike<DatabaseResult>;
}

interface ScanDatabase {
  from(table: "eticket"): {
    select(columns: string): EticketQuery;
  };
  from(table: "eticket_segment"): {
    select(columns: string): SegmentQuery;
  };
  rpc(
    functionName: "is_eticket_staff",
    args: { uid: string },
  ): PromiseLike<DatabaseResult>;
  rpc(
    functionName: "mark_segment_used",
    args: { p_segment_id: string; p_scanned_by: string },
  ): PromiseLike<DatabaseResult>;
}

interface ScanContext {
  database: ScanDatabase;
  claims: EticketTokenClaims;
  eticket: EticketRow;
  segments: EticketScanSegment[];
}

function isEticketRow(value: unknown): value is EticketRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["id"] === "string" &&
    typeof row["ticket_code"] === "string" &&
    (row["status"] === "valid" || row["status"] === "cancelled" || row["status"] === "expired") &&
    typeof row["expires_at"] === "string" &&
    (typeof row["qr_jti"] === "string" || row["qr_jti"] === null)
  );
}

function isEticketScanSegment(value: unknown): value is EticketScanSegment {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["id"] === "string" &&
    (row["kind"] === "transport" || row["kind"] === "attraction") &&
    (typeof row["label"] === "string" || row["label"] === null) &&
    typeof row["position"] === "number" &&
    (row["status"] === "unused" || row["status"] === "used" || row["status"] === "cancelled")
  );
}

function isEticketScanSegments(value: unknown): value is EticketScanSegment[] {
  return Array.isArray(value) && value.every(isEticketScanSegment);
}

async function getScanContext(token: string, userId: string): Promise<ScanContext> {
  const [{ supabaseAdmin }, { verifyEticketToken }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("@/lib/eticket-token.server"),
  ]);
  const database = supabaseAdmin as unknown as ScanDatabase;

  const { data: isStaff, error: roleError } = await database.rpc("is_eticket_staff", {
    uid: userId,
  });
  if (roleError) {
    console.error("[eticket-scan] Unable to verify staff role.", roleError);
    throw new Error("Staff access could not be verified.");
  }
  if (isStaff !== true) {
    throw new Error("Only staff or admin users may scan e-tickets.");
  }

  const claims = await verifyEticketToken(token);
  const { data: ticketData, error: ticketError } = await database
    .from("eticket")
    .select("id, ticket_code, status, expires_at, qr_jti")
    .eq("id", claims.sub)
    .maybeSingle();

  if (ticketError) {
    console.error("[eticket-scan] Unable to load the e-ticket.", ticketError);
    throw new Error("The e-ticket could not be verified.");
  }
  if (!isEticketRow(ticketData) || ticketData.qr_jti !== claims.jti) {
    throw new Error("This QR code is invalid or has been replaced.");
  }
  if (ticketData.status === "cancelled") {
    throw new Error("This e-ticket has been cancelled.");
  }
  if (
    ticketData.status === "expired" ||
    !Number.isFinite(Date.parse(ticketData.expires_at)) ||
    Date.parse(ticketData.expires_at) <= Date.now()
  ) {
    throw new Error("This e-ticket has expired.");
  }

  const { data: segmentData, error: segmentError } = await database
    .from("eticket_segment")
    .select("id, kind, label, position, status")
    .eq("eticket_id", ticketData.id);

  if (segmentError) {
    console.error("[eticket-scan] Unable to load e-ticket segments.", segmentError);
    throw new Error("The e-ticket segments could not be loaded.");
  }
  if (!isEticketScanSegments(segmentData)) {
    throw new Error("The e-ticket segment data is invalid.");
  }

  return {
    database,
    claims,
    eticket: ticketData,
    segments: segmentData.sort((left, right) => left.position - right.position),
  };
}

export const verifyEticketForScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(scanTokenSchema)
  .handler(async ({ data, context }) => {
    const scan = await getScanContext(data.token, context.userId);
    return {
      ticketCode: scan.eticket.ticket_code,
      expiresAt: scan.eticket.expires_at,
      segments: scan.segments,
    };
  });

async function getScanOutcome(
  database: ScanDatabase,
  eticketId: string,
  segmentId: string,
): Promise<"already_used" | "cancelled" | "expired" | "invalid_segment"> {
  const [{ data: eticketData, error: eticketError }, { data: segmentData, error: segmentError }] =
    await Promise.all([
      database
        .from("eticket")
        .select("id, ticket_code, status, expires_at, qr_jti")
        .eq("id", eticketId)
        .maybeSingle(),
      database
        .from("eticket_segment")
        .select("id, kind, label, position, status")
        .eq("id", segmentId)
        .maybeSingle(),
    ]);

  if (eticketError || segmentError) {
    console.error("[eticket-scan] Unable to reload scan state.", {
      eticketError,
      segmentError,
    });
    throw new Error("The scan result could not be confirmed.");
  }
  if (!isEticketRow(eticketData) || !isEticketScanSegment(segmentData)) {
    return "invalid_segment";
  }
  if (eticketData.status === "cancelled" || segmentData.status === "cancelled") {
    return "cancelled";
  }
  if (
    eticketData.status === "expired" ||
    !Number.isFinite(Date.parse(eticketData.expires_at)) ||
    Date.parse(eticketData.expires_at) <= Date.now()
  ) {
    return "expired";
  }
  if (segmentData.status === "used") return "already_used";
  return "invalid_segment";
}

export const scanEticketSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(scanSegmentSchema)
  .handler(async ({ data, context }) => {
    const scan = await getScanContext(data.token, context.userId);
    const segment = scan.segments.find((candidate) => candidate.id === data.segmentId);
    if (!segment) {
      return { result: "invalid_segment" as const };
    }

    const { data: updatedSegments, error } = await scan.database.rpc("mark_segment_used", {
      p_segment_id: data.segmentId,
      p_scanned_by: context.userId,
    });
    if (error) {
      console.error("[eticket-scan] Unable to mark the segment used.", error);
      throw new Error("The segment scan could not be recorded.");
    }

    if (isEticketScanSegments(updatedSegments)) {
      const updatedSegment = updatedSegments.find((row) => row.id === data.segmentId);
      if (updatedSegment?.status === "used") {
        return { result: "success" as const, segment: updatedSegment };
      }
    }

    return {
      result: await getScanOutcome(scan.database, scan.eticket.id, data.segmentId),
    };
  });
