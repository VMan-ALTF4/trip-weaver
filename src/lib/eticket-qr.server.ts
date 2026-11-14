import qrcode from "qrcode-generator";

export function createEticketQrSvg(token: string): string {
  if (!token.trim()) throw new Error("An e-ticket token is required to create a QR.");

  const code = qrcode(0, "M");
  code.addData(token, "Byte");
  code.make();
  return code.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
}
