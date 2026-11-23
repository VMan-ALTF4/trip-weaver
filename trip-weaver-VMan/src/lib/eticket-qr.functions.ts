import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eticketRequestSchema = z.union([
  z.object({ eticketId: z.string().uuid() }),
  z.object({ ticketCode: z.string().regex(/^TAT-[A-HJ-NP-Z2-9]{6}$/) }),
]);

interface EticketLookup {
  id: string;
  user_id: string;
}

interface DatabaseResult {
  data: unknown;
  error: { message: string } | null;
}

interface EticketQuery extends PromiseLike<DatabaseResult> {
  eq(column: "id" | "ticket_code", value: string): EticketQuery;
  maybeSingle(): PromiseLike<DatabaseResult>;
}

interface EticketDatabase {
  from(table: "eticket"): {
    select(columns: "id,user_id"): EticketQuery;
  };
}

interface EticketStaffClient {
  rpc(
    functionName: "is_eticket_staff",
    args: { uid: string },
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

function isEticketLookup(value: unknown): value is EticketLookup {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row["id"] === "string" && typeof row["user_id"] === "string";
}

export const getEticketQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(eticketRequestSchema)
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, { signEticketToken }, { createEticketQrSvg }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/eticket-token.server"),
      import("@/lib/eticket-qr.server"),
    ]);

    const database = supabaseAdmin as unknown as EticketDatabase;
    const column = "eticketId" in data ? "id" : "ticket_code";
    const value = "eticketId" in data ? data.eticketId : data.ticketCode;
    const { data: row, error } = await database
      .from("eticket")
      .select("id,user_id")
      .eq(column, value)
      .maybeSingle();

    if (error) {
      console.error("Unable to load e-ticket for QR retrieval.");
      throw new Error("The e-ticket is unavailable.");
    }
    if (!isEticketLookup(row)) {
      throw new Error("The e-ticket is unavailable.");
    }

    if (row.user_id !== context.userId) {
      if (!(await hasStaffOrAdmin(supabaseAdmin, context.userId))) {
        throw new Error("The e-ticket is unavailable.");
      }
    }

    const token = await signEticketToken(row.id);
    return { token, qrSvg: createEticketQrSvg(token) };
  });

async function hasStaffOrAdmin(
  client: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  userId: string,
): Promise<boolean> {
  const roleClient = client as unknown as EticketStaffClient;
  const { data, error } = await roleClient.rpc("is_eticket_staff", { uid: userId });
  if (error) {
    console.error("Unable to authorize e-ticket QR retrieval.");
    throw new Error("The e-ticket is unavailable.");
  }
  return data === true;
}

export const rotateEticketQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ eticketId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, { rotateEticketQr: rotateQrRecord }, { createEticketQrSvg }] =
      await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("@/lib/eticket-token.server"),
        import("@/lib/eticket-qr.server"),
      ]);

    if (!(await hasStaffOrAdmin(supabaseAdmin, context.userId))) {
      throw new Error("You are not allowed to reissue this e-ticket QR.");
    }

    const rotated = await rotateQrRecord(data.eticketId);
    return {
      ...rotated,
      qrSvg: createEticketQrSvg(rotated.token),
    };
  });
