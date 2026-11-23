import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, QrCode, RotateCcw, ShieldAlert } from "lucide-react";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  scanEticketSegment,
  verifyEticketForScan,
  type EticketScanSegment,
} from "@/lib/eticket-scan.functions";
import { useLanguage } from "@/lib/language";

export const Route = createFileRoute("/staff/scan")({
  head: () => ({
    meta: [{ title: "Staff QR scanner — TAT Booking" }],
  }),
  component: StaffScanPage,
});

interface DetectedBarcode {
  rawValue: string;
}

interface BrowserBarcodeDetector {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BrowserBarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BrowserBarcodeDetector;

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: BrowserBarcodeDetectorConstructor;
}

interface VerifiedTicket {
  ticketCode: string;
  expiresAt: string;
  segments: EticketScanSegment[];
}

type ScanResult = "success" | "already_used" | "cancelled" | "expired" | "invalid_segment";

function StaffScanPage() {
  const { t } = useLanguage();
  const { user, profile, loading, profileLoading } = useAuth();
  const [token, setToken] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [ticket, setTicket] = useState<VerifiedTicket | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const verifyToken = useCallback(
    async (rawToken: string) => {
      const cleanToken = rawToken.trim();
      if (!cleanToken) return;

      stopCamera();
      setVerifying(true);
      setError("");
      setResult(null);
      setTicket(null);
      setVerifiedToken("");
      setSelectedSegmentId("");

      try {
        const verified = await verifyEticketForScan({ data: { token: cleanToken } });
        setTicket(verified);
        setVerifiedToken(cleanToken);
        setSelectedSegmentId(
          verified.segments.find(
            (segment) => segment.kind === "transport" && segment.status === "unused",
          )?.id ??
            verified.segments.find((segment) => segment.status !== "cancelled")?.id ??
            "",
        );
        setToken("");
      } catch (verificationError) {
        setError(
          verificationError instanceof Error
            ? verificationError.message
            : t("The e-ticket could not be verified."),
        );
      } finally {
        setVerifying(false);
      }
    },
    [stopCamera, t],
  );

  const startCamera = useCallback(async () => {
    const Detector = (window as WindowWithBarcodeDetector).BarcodeDetector;
    if (!Detector) {
      setError(t("Camera scanning is unavailable in this browser; paste the QR token below."));
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(t("Camera access requires a secure HTTPS page."));
      return;
    }

    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setCameraActive(true);

      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();

      const detector = new Detector({ formats: ["qr_code"] });
      const detectFrame = async () => {
        if (!streamRef.current) return;
        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const barcodes = await detector.detect(video);
            const qrToken = barcodes.find((barcode) => barcode.rawValue.trim())?.rawValue;
            if (qrToken) {
              stopCamera();
              await verifyToken(qrToken);
              return;
            }
          }
          animationFrameRef.current = requestAnimationFrame(() => void detectFrame());
        } catch (scanError) {
          stopCamera();
          setError(
            scanError instanceof Error
              ? scanError.message
              : t("The camera could not scan this QR code."),
          );
        }
      };
      animationFrameRef.current = requestAnimationFrame(() => void detectFrame());
    } catch (cameraError) {
      stopCamera();
      setError(
        cameraError instanceof Error
          ? cameraError.message
          : t("Camera access was denied or unavailable."),
      );
    }
  }, [stopCamera, t, verifyToken]);

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await verifyToken(token);
  }

  async function handleMarkUsed() {
    if (!ticket || !selectedSegmentId || !verifiedToken) {
      setError(t("Scan or enter a QR token before choosing a segment."));
      return;
    }

    setScanning(true);
    setError("");
    setResult(null);
    try {
      const response = await scanEticketSegment({
        data: { token: verifiedToken, segmentId: selectedSegmentId },
      });
      setResult(response.result);
      if (response.result === "success") {
        setTicket((current) =>
          current
            ? {
                ...current,
                segments: current.segments.map((segment) =>
                  segment.id === selectedSegmentId ? { ...segment, status: "used" } : segment,
                ),
              }
            : current,
        );
      }
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : t("The segment scan could not be recorded."),
      );
    } finally {
      setScanning(false);
    }
  }

  function startAnotherScan() {
    stopCamera();
    setTicket(null);
    setToken("");
    setVerifiedToken("");
    setSelectedSegmentId("");
    setResult(null);
    setError("");
  }

  const isStaff = profile?.role === "admin" || profile?.role === "staff";

  if (loading || profileLoading) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <p className="text-sm text-muted-foreground">{t("Checking staff access...")}</p>
      </main>
    );
  }

  if (!user || !isStaff) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-soft">
          <ShieldAlert className="mx-auto size-8 text-destructive" aria-hidden />
          <h1 className="mt-3 font-display text-xl font-bold">{t("Staff access required")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Only staff or admin users may scan e-tickets.")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal">
              {t("Staff QR scanner")}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold">{t("Scan e-ticket")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Scan the QR code, then choose the vehicle or attraction segment to validate.")}
            </p>
          </div>

          <section className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void startCamera()} disabled={cameraActive || verifying}>
                <Camera aria-hidden />
                {t("Start camera")}
              </Button>
              {cameraActive && (
                <Button type="button" variant="outline" onClick={stopCamera}>
                  {t("Stop camera")}
                </Button>
              )}
              {ticket && (
                <Button type="button" variant="outline" onClick={startAnotherScan}>
                  <RotateCcw aria-hidden />
                  {t("Scan another ticket")}
                </Button>
              )}
            </div>

            <div className={cameraActive ? "mt-4 overflow-hidden rounded-lg bg-black" : "hidden"}>
              <video
                ref={videoRef}
                className="max-h-80 w-full object-contain"
                autoPlay
                muted
                playsInline
              />
            </div>

            <form onSubmit={handleVerifySubmit} className="mt-5 space-y-3">
              <label htmlFor="eticket-qr-token" className="block text-sm font-medium">
                {t("Enter QR token")}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="eticket-qr-token"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder={t("Paste the token from the e-ticket QR")}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" variant="secondary" disabled={verifying || !token.trim()}>
                  <QrCode aria-hidden />
                  {verifying ? t("Verifying...") : t("Verify QR")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("If camera scanning is unavailable, paste the QR token here.")}
              </p>
            </form>

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {ticket && (
              <div className="mt-6 border-t border-border pt-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("Verified ticket")}
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold">{ticket.ticketCode}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("Expires")}: {new Date(ticket.expiresAt).toLocaleString()}
                  </p>
                </div>

                <h2 className="mt-5 font-display text-lg font-semibold">
                  {t("Select a ticket segment")}
                </h2>
                <div className="mt-3 space-y-2">
                  {ticket.segments.map((segment) => (
                    <button
                      key={segment.id}
                      type="button"
                      onClick={() => setSelectedSegmentId(segment.id)}
                      aria-pressed={selectedSegmentId === segment.id}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedSegmentId === segment.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-secondary/50"
                      }`}
                    >
                      <span>
                        <span className="block font-medium">
                          {segment.kind === "transport"
                            ? t("Vehicle boarding")
                            : `${t("Attraction entry")}: ${segment.label ?? ""}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {segment.status === "unused"
                            ? t("Unused")
                            : segment.status === "used"
                              ? t("Used")
                              : t("Cancelled")}
                        </span>
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {t(segment.kind === "transport" ? "Transport" : "Attraction")}
                      </span>
                    </button>
                  ))}
                </div>

                {result && (
                  <p
                    role="status"
                    className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
                      result === "success"
                        ? "bg-teal/10 text-teal"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {result === "success"
                      ? t("Accepted: segment marked used.")
                      : result === "already_used"
                        ? t("Rejected: this segment was already used.")
                        : result === "cancelled"
                          ? t("Rejected: this ticket segment is cancelled.")
                          : result === "expired"
                            ? t("Rejected: this e-ticket has expired.")
                            : t("Rejected: the selected segment is invalid.")}
                  </p>
                )}

                <Button
                  type="button"
                  className="mt-5 w-full sm:w-auto"
                  onClick={() => void handleMarkUsed()}
                  disabled={scanning || !selectedSegmentId}
                >
                  {scanning ? t("Recording scan...") : t("Mark segment used")}
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
