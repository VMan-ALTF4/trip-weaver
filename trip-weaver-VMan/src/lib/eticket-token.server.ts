import {
  decodeProtectedHeader,
  exportJWK,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
  type JWK,
} from "jose";

const ETICKET_ALGORITHM = "ES256";
const ETICKET_COLUMNS = "id,expires_at,qr_jti,qr_issued_at,qr_key_id";

export interface EticketTokenClaims {
  iss: string;
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface EticketQrMetadata {
  qr_jti: string;
  qr_issued_at: string;
  qr_key_id: string;
}

interface PublicKeyConfig {
  kid: string;
  pem: string;
}

interface EticketTokenRow {
  id: string;
  expires_at: string;
  qr_jti: string | null;
  qr_issued_at: string | null;
  qr_key_id: string | null;
}

interface DatabaseResult {
  data: unknown;
  error: { message: string } | null;
}

interface EticketQuery extends PromiseLike<DatabaseResult> {
  eq(column: "id" | "qr_jti", value: string): EticketQuery;
  is(column: "qr_jti", value: null): EticketQuery;
  maybeSingle(): PromiseLike<DatabaseResult>;
}

interface EticketMutationQuery {
  eq(column: "id" | "qr_jti", value: string): EticketMutationQuery;
  is(column: "qr_jti", value: null): EticketMutationQuery;
  select(columns: string): EticketQuery;
}

interface EticketDatabase {
  from(table: "eticket"): {
    select(columns: string): EticketQuery;
    update(values: {
      qr_jti?: string;
      qr_issued_at?: string;
      qr_key_id?: string;
    }): EticketMutationQuery;
  };
}

function getRequiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `E-ticket signing is not configured: missing ${name}. Set the server-only ETICKET_* variables and reload the app.`,
    );
  }
  return value;
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function getActiveKeyId(): string {
  const kid = getRequiredEnvironment("ETICKET_KEY_ID");
  if (kid.length > 128) {
    throw new Error("ETICKET_KEY_ID must not exceed 128 characters.");
  }
  return kid;
}

function parseAdditionalPublicKeys(): PublicKeyConfig[] {
  const value = process.env["ETICKET_ADDITIONAL_PUBLIC_KEYS"]?.trim();
  if (!value) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("ETICKET_ADDITIONAL_PUBLIC_KEYS must be a JSON array.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("ETICKET_ADDITIONAL_PUBLIC_KEYS must be a JSON array.");
  }

  return parsed.map((entry): PublicKeyConfig => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("kid" in entry) ||
      !("pem" in entry) ||
      typeof entry.kid !== "string" ||
      typeof entry.pem !== "string" ||
      !entry.kid.trim() ||
      !entry.pem.trim()
    ) {
      throw new Error("An additional e-ticket public key is malformed.");
    }

    return { kid: entry.kid.trim(), pem: normalizePem(entry.pem.trim()) };
  });
}

function getConfiguredPublicKeys(): PublicKeyConfig[] {
  const activeKey: PublicKeyConfig = {
    kid: getActiveKeyId(),
    pem: normalizePem(getRequiredEnvironment("ETICKET_PUBLIC_KEY")),
  };
  const allKeys = [activeKey, ...parseAdditionalPublicKeys()];
  const seenKids = new Set<string>();

  for (const key of allKeys) {
    if (seenKids.has(key.kid)) {
      throw new Error(`Duplicate e-ticket public key ID: ${key.kid}.`);
    }
    seenKids.add(key.kid);
  }

  return allKeys;
}

function isEticketTokenRow(value: unknown): value is EticketTokenRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["id"] === "string" &&
    typeof row["expires_at"] === "string" &&
    (typeof row["qr_jti"] === "string" || row["qr_jti"] === null) &&
    (typeof row["qr_issued_at"] === "string" || row["qr_issued_at"] === null) &&
    (typeof row["qr_key_id"] === "string" || row["qr_key_id"] === null)
  );
}

async function getEticketDatabase(): Promise<EticketDatabase> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Kiểu Supabase sinh tự động chưa có bảng eticket; kiểm tra dữ liệu tại biên DB.
  return supabaseAdmin as unknown as EticketDatabase;
}

async function readEticketTokenRow(eticketId: string): Promise<EticketTokenRow> {
  const database = await getEticketDatabase();
  const { data, error } = await database
    .from("eticket")
    .select(ETICKET_COLUMNS)
    .eq("id", eticketId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load e-ticket signing data.");
    throw new Error("The e-ticket could not be loaded.");
  }
  if (!isEticketTokenRow(data)) {
    throw new Error("The e-ticket could not be loaded.");
  }
  return data;
}

async function updateTokenMetadata(
  eticketId: string,
  values: { qr_jti?: string; qr_issued_at?: string; qr_key_id?: string },
  expectedJti: string | null,
): Promise<EticketTokenRow | null> {
  const database = await getEticketDatabase();
  let query = database.from("eticket").update(values).eq("id", eticketId);
  query = expectedJti === null ? query.is("qr_jti", null) : query.eq("qr_jti", expectedJti);

  const { data, error } = await query.select(ETICKET_COLUMNS).maybeSingle();
  if (error) {
    console.error("Unable to update e-ticket QR metadata.");
    throw new Error("The e-ticket QR could not be updated.");
  }
  if (data === null) return null;
  if (!isEticketTokenRow(data)) {
    throw new Error("The e-ticket QR update returned invalid data.");
  }
  return data;
}

async function getReadyEticket(eticketId: string, activeKeyId: string): Promise<EticketTokenRow> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await readEticketTokenRow(eticketId);
    const hasAllQrFields =
      row.qr_jti !== null && row.qr_issued_at !== null && row.qr_key_id !== null;
    const hasNoQrFields =
      row.qr_jti === null && row.qr_issued_at === null && row.qr_key_id === null;

    if (hasNoQrFields) {
      const issuedAt = Math.floor(Date.now() / 1000) * 1000;
      const updated = await updateTokenMetadata(
        eticketId,
        {
          qr_jti: crypto.randomUUID(),
          qr_issued_at: new Date(issuedAt).toISOString(),
          qr_key_id: activeKeyId,
        },
        null,
      );
      if (updated) return updated;
      continue;
    }

    if (!hasAllQrFields || !row.qr_jti || !row.qr_issued_at || !row.qr_key_id) {
      throw new Error("The e-ticket QR metadata is incomplete.");
    }

    if (row.qr_key_id === activeKeyId) return row;
    const updated = await updateTokenMetadata(eticketId, { qr_key_id: activeKeyId }, row.qr_jti);
    if (updated) return updated;
  }

  throw new Error("The e-ticket QR changed concurrently. Please retry.");
}

function toClaims(row: EticketTokenRow, issuer: string): EticketTokenClaims {
  const issuedAtMilliseconds = Date.parse(row.qr_issued_at ?? "");
  const expiresAtMilliseconds = Date.parse(row.expires_at);
  if (!Number.isFinite(issuedAtMilliseconds) || !Number.isFinite(expiresAtMilliseconds)) {
    throw new Error("The e-ticket has invalid token dates.");
  }
  if (!row.qr_jti) {
    throw new Error("The e-ticket has no QR identifier.");
  }

  return {
    iss: issuer,
    sub: row.id,
    jti: row.qr_jti,
    iat: Math.floor(issuedAtMilliseconds / 1000),
    exp: Math.floor(expiresAtMilliseconds / 1000),
  };
}

export async function signEticketClaims(
  claims: EticketTokenClaims,
  privateKeyPem: string,
  keyId: string,
): Promise<string> {
  if (claims.iss !== getRequiredEnvironment("ETICKET_ISSUER")) {
    throw new Error("The e-ticket issuer does not match the configured issuer.");
  }

  const privateKey = await importPKCS8(normalizePem(privateKeyPem), ETICKET_ALGORITHM);
  return new SignJWT({})
    .setProtectedHeader({ alg: ETICKET_ALGORITHM, kid: keyId, typ: "JWT" })
    .setIssuer(claims.iss)
    .setSubject(claims.sub)
    .setJti(claims.jti)
    .setIssuedAt(claims.iat)
    .setExpirationTime(claims.exp)
    .sign(privateKey);
}

export async function signEticketToken(eticketId: string): Promise<string> {
  if (!eticketId.trim()) throw new Error("An e-ticket ID is required.");

  const activeKeyId = getActiveKeyId();
  const privateKeyPem = normalizePem(getRequiredEnvironment("ETICKET_PRIVATE_KEY"));
  const readyEticket = await getReadyEticket(eticketId, activeKeyId);
  const claims = toClaims(readyEticket, getRequiredEnvironment("ETICKET_ISSUER"));

  return signEticketClaims(claims, privateKeyPem, activeKeyId);
}

export async function ensureEticketQrMetadata(eticketId: string): Promise<EticketQrMetadata> {
  if (!eticketId.trim()) throw new Error("An e-ticket ID is required.");
  const row = await getReadyEticket(eticketId, getActiveKeyId());
  if (!row.qr_jti || !row.qr_issued_at || !row.qr_key_id) {
    throw new Error("The e-ticket QR metadata is incomplete.");
  }
  return {
    qr_jti: row.qr_jti,
    qr_issued_at: row.qr_issued_at,
    qr_key_id: row.qr_key_id,
  };
}

export async function verifyEticketToken(token: string): Promise<EticketTokenClaims> {
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== ETICKET_ALGORITHM || typeof header.kid !== "string") {
      throw new Error("Unsupported token header.");
    }

    const keyConfig = getConfiguredPublicKeys().find((key) => key.kid === header.kid);
    if (!keyConfig) throw new Error("Unknown key ID.");

    const publicKey = await importSPKI(keyConfig.pem, ETICKET_ALGORITHM);
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: [ETICKET_ALGORITHM],
      issuer: getRequiredEnvironment("ETICKET_ISSUER"),
      requiredClaims: ["iss", "sub", "jti", "iat", "exp"],
    });

    if (
      typeof payload.iss !== "string" ||
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      throw new Error("Required token claims are invalid.");
    }

    return {
      iss: payload.iss,
      sub: payload.sub,
      jti: payload.jti,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    console.error(
      "E-ticket token verification failed.",
      error instanceof Error ? error.message : "Unknown verification error.",
    );
    throw new Error("Invalid e-ticket token.");
  }
}

export async function getEticketJwks(): Promise<{ keys: JWK[] }> {
  const publicKeys = getConfiguredPublicKeys();
  const keys: JWK[] = [];

  for (const { kid, pem } of publicKeys) {
    const key = await importSPKI(pem, ETICKET_ALGORITHM);
    keys.push({
      ...(await exportJWK(key)),
      alg: ETICKET_ALGORITHM,
      kid,
      use: "sig",
    });
  }

  return { keys };
}

export async function rotateEticketQr(
  eticketId: string,
): Promise<{ token: string; qrJti: string; qrIssuedAt: string; keyId: string }> {
  if (!eticketId.trim()) throw new Error("An e-ticket ID is required.");

  const activeKeyId = getActiveKeyId();
  const privateKeyPem = normalizePem(getRequiredEnvironment("ETICKET_PRIVATE_KEY"));
  await importPKCS8(privateKeyPem, ETICKET_ALGORITHM);

  const current = await readEticketTokenRow(eticketId);
  const previousIssuedAt = current.qr_issued_at ? Date.parse(current.qr_issued_at) : 0;
  if (!Number.isFinite(previousIssuedAt)) {
    throw new Error("The e-ticket has an invalid QR issue date.");
  }
  const issuedAt = new Date(Math.max(Date.now(), previousIssuedAt + 1)).toISOString();
  const updated = await updateTokenMetadata(
    eticketId,
    {
      qr_jti: crypto.randomUUID(),
      qr_issued_at: issuedAt,
      qr_key_id: activeKeyId,
    },
    current.qr_jti,
  );
  if (!updated?.qr_jti || !updated.qr_issued_at || !updated.qr_key_id) {
    throw new Error("The e-ticket QR changed concurrently. Please retry.");
  }

  return {
    token: await signEticketToken(eticketId),
    qrJti: updated.qr_jti,
    qrIssuedAt: updated.qr_issued_at,
    keyId: updated.qr_key_id,
  };
}
