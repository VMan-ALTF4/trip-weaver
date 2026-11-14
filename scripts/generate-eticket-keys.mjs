import { webcrypto } from "node:crypto";

function toPem(label, bytes) {
  const encoded = Buffer.from(bytes).toString("base64");
  const lines = encoded.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const privateKey = await webcrypto.subtle.exportKey("pkcs8", pair.privateKey);
const publicKey = await webcrypto.subtle.exportKey("spki", pair.publicKey);

function envValue(value) {
  return `"${value.replace(/\r?\n/g, "\\n")}"`;
}

console.log(`ETICKET_KEY_ID=k1`);
console.log(`ETICKET_ISSUER=tat-booking`);
console.log(`ETICKET_PRIVATE_KEY=${envValue(toPem("PRIVATE KEY", privateKey))}`);
console.log(`ETICKET_PUBLIC_KEY=${envValue(toPem("PUBLIC KEY", publicKey))}`);
console.log(`ETICKET_ADDITIONAL_PUBLIC_KEYS=[]`);
