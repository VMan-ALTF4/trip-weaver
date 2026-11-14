import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Clock3, Download, Loader2, Mail, MapPin, QrCode, Ticket, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { resendEticketEmail } from "@/lib/email.server";
import { EticketViewError, getOrderEtickets } from "@/lib/eticket-view.server";
import { issueTickets } from "@/lib/tickets.server";
import { useLanguage } from "@/lib/language";

export const Route = createFileRoute("/eticket/$orderId")({
  head: () => ({
    meta: [{ title: "E-ticket — TAT Booking" }],
  }),
  component: EticketPage,
});

type TicketView = {
  id: string;
  order_id: string;
  ticket_status: string;
  ticket_issue_status: "pending_issue" | "issued" | null;
  travel_date: string | null;
  pickup_location: string | null;
  seat_numbers: string[];
  price: number;
  created_at: string;
  eticket: {
    id: string;
    ticket_id: string;
    user_id: string;
    ticket_code: string;
    status: "valid" | "cancelled" | "expired";
    tour_name: string;
    travel_date: string;
    pickup_location: string | null;
    pickup_time: string | null;
    seat_no: string | null;
    holder_name: string | null;
    expires_at: string;
    qrSvg: string | null;
    created_at: string;
  } | null;
  segments: Array<{
    id: string;
    eticket_id: string;
    kind: "transport" | "attraction";
    label: string | null;
    position: number;
    status: "unused" | "used" | "cancelled";
    used_at: string | null;
    scanned_by: string | null;
    created_at: string;
  }>;
};

function EticketPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { orderId } = Route.useParams();
  const [tickets, setTickets] = useState<TicketView[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pageError, setPageError] = useState<{ code: string; title: string; detail: string } | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const result = await getOrderEtickets({ data: { orderId } });
      setTickets(result.tickets as TicketView[]);
    } catch (error) {
      console.error("Unable to load e-ticket data.", error);

      const eticketError = error instanceof EticketViewError ? error : null;
      const code =
        eticketError?.code ??
        (error instanceof Error && /missing .*ETICKET_|E-ticket signing is not configured/i.test(error.message)
          ? "not_configured"
          : "system");
      const messageMap: Record<string, { title: string; detail: string }> = {
        not_authenticated: {
          title: "Please sign in to continue",
          detail: "You must be signed in to view your e-ticket.",
        },
        forbidden: {
          title: "This e-ticket is private",
          detail: "You do not have permission to view this booking.",
        },
        not_found: {
          title: "Booking not found",
          detail: "We could not find this booking in your account.",
        },
        not_issued: {
          title: "This e-ticket is not available yet",
          detail: "This order has not issued an e-ticket yet. Please retry to generate it.",
        },
        processing: {
          title: "Your e-ticket is being prepared",
          detail: "This order is still creating ticket data. Please wait a moment and try again.",
        },
        not_configured: {
          title: "E-ticket signing is not configured",
          detail: "The server is missing ETICKET_* keys. Please add the server-only QR signing keys and reload the page.",
        },
        system: {
          title: "The e-ticket could not be loaded",
          detail: "A system error occurred while preparing your ticket. Please try again in a moment.",
        },
      };

      const nextError = messageMap[code] ?? messageMap.system;
      setPageError({ code, ...nextError });
      if (code !== "not_authenticated" && code !== "forbidden") {
        toast.error(nextError.title);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTickets([]);
      setPageError({
        code: "not_authenticated",
        title: "Please sign in to continue",
        detail: "You must be signed in to view your e-ticket.",
      });
      setLoading(false);
      return;
    }

    void loadTickets();
  }, [authLoading, loadTickets, user]);

  const overallStatus = useMemo(() => {
    if (!tickets.length) return "pending";
    return tickets.every((ticket) => ticket.eticket && ticket.eticket.status === "valid")
      ? "valid"
      : tickets.some((ticket) => ticket.eticket && ticket.eticket.status === "expired")
        ? "expired"
        : tickets.some((ticket) => ticket.eticket && ticket.eticket.status === "cancelled")
          ? "cancelled"
          : "processing";
  }, [tickets]);

  const handleRetryIssue = async () => {
    setRetrying(true);
    setPageError(null);
    try {
      const result = await issueTickets(orderId);
      toast.success(result === "issued" ? "E-ticket issued successfully." : "E-ticket is being issued.");
      await loadTickets();
    } catch (error) {
      console.error("Unable to retry ticket issuance.", error);
      const detail = error instanceof Error ? error.message : "Ticket issuance could not be retried.";
      setPageError({
        code: "not_issued",
        title: "This e-ticket is not available yet",
        detail,
      });
      toast.error(detail);
    } finally {
      setRetrying(false);
    }
  };

  const handleResendEmail = async () => {
    setSending(true);
    try {
      const result = await resendEticketEmail({ data: { orderId, force: false } });
      if (result.status === "sent") {
        toast.success("E-ticket email sent successfully.");
      } else if (result.status === "skipped") {
        toast.info(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Unable to resend e-ticket email.", error);
      toast.error(error instanceof Error ? error.message : "The e-ticket email could not be resent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">{t("E-ticket")}</p>
            <h1 className="font-display text-3xl font-extrabold">{t("Your trip tickets")}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Download className="size-4" aria-hidden /> {t("Print / PDF")}
            </Button>
            <Button variant="outline" disabled>
              <QrCode className="size-4" aria-hidden /> {t("Add to Wallet")}
            </Button>
            <Button variant="outline" onClick={() => void handleResendEmail()} disabled={sending}>
              <Mail className="size-4" aria-hidden /> {sending ? t("Sending...") : t("Email ticket")}
            </Button>
          </div>
        </div>

        {overallStatus === "processing" && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-5" aria-hidden />
              {t("Your e-ticket is being prepared.")}
            </div>
            <p className="mt-2 text-sm">{t("This order is still creating QR and ticket data.")}</p>
            <Button className="mt-3" variant="outline" onClick={() => void handleRetryIssue()} disabled={retrying}>
              {retrying ? t("Retrying...") : t("Retry issuance")}
            </Button>
          </div>
        )}

        {pageError && (
          <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-destructive">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{pageError.title}</p>
                <p className="mt-1 text-sm opacity-90">{pageError.detail}</p>
              </div>
              <div className="flex gap-2">
                {pageError.code === "not_issued" || pageError.code === "processing" ? (
                  <Button variant="outline" onClick={() => void handleRetryIssue()} disabled={retrying}>
                    {retrying ? "Retrying..." : "Retry issuance"}
                  </Button>
                ) : null}
                {pageError.code === "not_authenticated" ? (
                  <Button variant="outline" onClick={() => void navigate({ to: "/tours", replace: true })}>
                    Go to tours
                  </Button>
                ) : pageError.code === "forbidden" ? (
                  <Button variant="outline" onClick={() => void navigate({ to: "/my-bookings", replace: true })}>
                    Back to my bookings
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-border bg-card">
            <Loader2 className="size-8 animate-spin text-primary" aria-label="Loading e-tickets" />
          </div>
        ) : !tickets.length ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            {t("No e-ticket is available for this order yet.")}
          </div>
        ) : (
          <div className="grid gap-6">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <div className="border-b border-border bg-secondary/30 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("Ticket")}</p>
                      <h2 className="font-display text-xl font-bold">
                        {ticket.eticket?.tour_name ?? t("Tour booking")}
                      </h2>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("Code")}</div>
                      <div className="font-display text-lg font-bold">
                        {ticket.eticket?.ticket_code ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {!ticket.eticket ? (
                  <div className="p-5">
                    <p className="text-sm text-muted-foreground">{t("This ticket has not been issued yet.")}</p>
                  </div>
                ) : (
                  <div className="grid gap-6 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="flex flex-col items-center rounded-2xl border border-border bg-secondary/20 p-4 text-center">
                      <div className="flex size-52 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-sm">
                        {ticket.eticket.qrSvg ? (
                          <div className="w-full" dangerouslySetInnerHTML={{ __html: ticket.eticket.qrSvg }} />
                        ) : (
                          <QrCode className="size-20 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("Scan QR")}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <InfoRow Icon={CalendarDays} label={t("Travel date")} value={ticket.eticket.travel_date || "—"} />
                        <InfoRow Icon={MapPin} label={t("Pickup point")} value={ticket.eticket.pickup_location || "—"} />
                        <InfoRow
                          Icon={Ticket}
                          label={t("Seat")}
                          value={ticket.eticket.seat_no ?? (ticket.seat_numbers.length ? ticket.seat_numbers.join(", ") : "—")}
                        />
                        <InfoRow Icon={Clock3} label={t("Pickup time")} value={ticket.eticket.pickup_time || "—"} />
                        <InfoRow Icon={UserRound} label={t("Traveller")} value={ticket.eticket.holder_name || "—"} />
                        <InfoRow Icon={Ticket} label={t("Status")} value={ticket.eticket.status} />
                      </div>

                      <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">{t("Ticket segments")}</h3>
                        {ticket.segments.length === 0 ? (
                          <p className="mt-2 text-sm text-muted-foreground">{t("No segments are available yet.")}</p>
                        ) : (
                          <ul className="mt-3 space-y-2 text-sm">
                            {ticket.segments.map((segment) => (
                              <li key={segment.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
                                <span>
                                  {segment.kind === "transport" ? t("Transport") : t("Attraction")}
                                  {segment.label ? ` · ${segment.label}` : ""}
                                </span>
                                <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide">
                                  {segment.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
      <style>{`
        @media print {
          body { background: white; }
          header, footer, button, .no-print { display: none !important; }
          main { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}

function InfoRow({ Icon, label, value }: { Icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <div className="mt-1 break-words font-medium">{value}</div>
      </div>
    </div>
  );
}
