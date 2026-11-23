import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { test } from "node:test";
import { SignJWT, decodeJwt, decodeProtectedHeader } from "jose";

globalThis.crypto ??= webcrypto;

function toPem(label, bytes) {
  const encoded = Buffer.from(bytes).toString("base64");
  const lines = encoded.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

async function createKeyPair() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  return {
    privateKeyPem: toPem("PRIVATE KEY", await crypto.subtle.exportKey("pkcs8", pair.privateKey)),
    publicKeyPem: toPem("PUBLIC KEY", await crypto.subtle.exportKey("spki", pair.publicKey)),
  };
}

const activeKeys = await createKeyPair();
const otherKeys = await createKeyPair();
process.env.ETICKET_ISSUER = "tat-booking";
process.env.ETICKET_KEY_ID = "k1";
process.env.ETICKET_PUBLIC_KEY = activeKeys.publicKeyPem;
process.env.ETICKET_ADDITIONAL_PUBLIC_KEYS = "[]";
const { signEticketClaims, verifyEticketToken } =
  await import("../src/lib/eticket-token.server.ts");
const { createEticketQrSvg } = await import("../src/lib/eticket-qr.server.ts");
const claims = {
  iss: "tat-booking",
  sub: "6f3a5bb6-1c49-4a2d-b579-aec5d03cf1a8",
  jti: "qr-id-1",
  iat: 1_800_000_000,
  exp: 1_900_000_000,
};

test("ES256 token verifies with required claims and no personal data", async () => {
  const token = await signEticketClaims(claims, activeKeys.privateKeyPem, "k1");
  const verified = await verifyEticketToken(token);
  assert.deepEqual(verified, claims);
  assert.deepEqual(Object.keys(decodeJwt(token)).sort(), ["exp", "iat", "iss", "jti", "sub"]);
});

test("tampered payload and signature are rejected", async () => {
  const token = await signEticketClaims(claims, activeKeys.privateKeyPem, "k1");
  const parts = token.split(".");
  assert.equal(parts.length, 3);

  const payload = parts[1] ?? "";
  const signature = parts[2] ?? "";
  const changedPayload = `${parts[0]}.${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}.${signature}`;
  const changedSignature = `${parts[0]}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

  await assert.rejects(verifyEticketToken(changedPayload), /Invalid e-ticket token/);
  await assert.rejects(verifyEticketToken(changedSignature), /Invalid e-ticket token/);
});

test("a different signing key or unknown kid is rejected", async () => {
  const wrongKeyToken = await signEticketClaims(claims, otherKeys.privateKeyPem, "k1");
  const unknownKidToken = await signEticketClaims(claims, otherKeys.privateKeyPem, "unknown");

  await assert.rejects(verifyEticketToken(wrongKeyToken), /Invalid e-ticket token/);
  await assert.rejects(verifyEticketToken(unknownKidToken), /Invalid e-ticket token/);
});

test("a retained public key verifies tokens from an older kid", async () => {
  process.env.ETICKET_ADDITIONAL_PUBLIC_KEYS = JSON.stringify([
    { kid: "k0", pem: otherKeys.publicKeyPem },
  ]);
  const oldToken = await signEticketClaims(claims, otherKeys.privateKeyPem, "k0");

  assert.deepEqual(await verifyEticketToken(oldToken), claims);
  process.env.ETICKET_ADDITIONAL_PUBLIC_KEYS = "[]";
});

test("alg none and non-whitelisted algorithms are rejected", async () => {
  const token = await signEticketClaims(claims, activeKeys.privateKeyPem, "k1");
  const [header, payload] = token.split(".");
  assert.ok(header);
  assert.ok(payload);
  const base64url = (value) => Buffer.from(value).toString("base64url");
  const noneToken = `${base64url('{"alg":"none","kid":"k1"}')}.${payload}.`;
  const otherAlgorithmToken = await new SignJWT({
    sub: claims.sub,
    jti: claims.jti,
    iat: claims.iat,
    exp: claims.exp,
  })
    .setIssuer(claims.iss)
    .setProtectedHeader({ alg: "HS256", kid: "k1" })
    .sign(new TextEncoder().encode("not-a-production-key"));

  await assert.rejects(verifyEticketToken(noneToken), /Invalid e-ticket token/);
  await assert.rejects(verifyEticketToken(otherAlgorithmToken), /Invalid e-ticket token/);
});

test("expired token is rejected", async () => {
  const token = await signEticketClaims(
    { ...claims, exp: Math.floor(Date.now() / 1000) - 60 },
    activeKeys.privateKeyPem,
    "k1",
  );
  await assert.rejects(verifyEticketToken(token), /Invalid e-ticket token/);
});

test("repeated signing keeps the same claims and rotation changes jti", async () => {
  const first = await signEticketClaims(claims, activeKeys.privateKeyPem, "k1");
  const repeated = await signEticketClaims(claims, activeKeys.privateKeyPem, "k1");
  assert.deepEqual(await verifyEticketToken(first), await verifyEticketToken(repeated));

  const rotatedClaims = { ...claims, jti: "qr-id-2", iat: claims.iat + 1 };
  const rotated = await signEticketClaims(rotatedClaims, activeKeys.privateKeyPem, "k1");
  assert.notEqual((await verifyEticketToken(first)).jti, (await verifyEticketToken(rotated)).jti);
});

test("QR SVG can encode a compact JWT at error-correction level M", async () => {
  const token = await signEticketClaims(claims, activeKeys.privateKeyPem, "k1");
  assert.ok(token.length < 512);
  const svg = createEticketQrSvg(token);

  assert.match(svg, /^<svg\b/);
  assert.match(svg, /viewBox=/);
});

test("protected header includes the configured key identifier", async () => {
  const token = await signEticketClaims(claims, activeKeys.privateKeyPem, "k1");
  assert.deepEqual(decodeProtectedHeader(token), { alg: "ES256", kid: "k1", typ: "JWT" });
});
