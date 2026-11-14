import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CreditCard,
  Loader2,
  QrCode,
  Timer,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/lib/currency";
import { useLanguage } from "@/lib/language";
import { closeTicketOrder, confirmTicketPayment } from "@/lib/payments.functions";

const HOLD_DURATION_MS = 10 * 60 * 1000;

type Ticket = {
  id: string;
  tour_id: string;
  user_id: string;
  ticket_status: "pending" | "sold" | "expired" | "cancelled";
  pickup_location: string | null;
  order_id: string;
  seat_numbers: string[];
  addons: unknown;
  price: number;
  travel_date: string | null;
  created_at: string;
};

const paymentMethods = [
  { id: "vnpay", label: "VNPay", Icon: Wallet },
  { id: "momo", label: "Momo", Icon: Wallet },
  { id: "card", label: "Credit / Debit Card", Icon: CreditCard },
  { id: "bank_transfer", label: "Bank Transfer", Icon: Building2 },
] as const;

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => {
    const ticketIds = Array.isArray(search["ticket_ids"])
      ? search["ticket_ids"].filter((id): id is string => typeof id === "string")
      : [];
    const ticketId = typeof search["ticket_id"] === "string" ? search["ticket_id"] : undefined;
    const orderId = typeof search["order_id"] === "string" ? search["order_id"] : undefined;
    return {
      ...(ticketIds.length ? { ticket_ids: ticketIds } : {}),
      ...(ticketId ? { ticket_id: ticketId } : {}),
      ...(orderId ? { order_id: orderId } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Checkout — TAT Booking" },
      {
        name: "description",
        content: "Review your booking and pay with VNPay, Momo, card or bank transfer.",
      },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    order_id: searchOrderId,
    ticket_id: ticketId,
    ticket_ids: searchTicketIds,
  } = Route.useSearch();
  const ticketIds = useMemo(
    () => [...new Set(searchTicketIds ?? (ticketId ? [ticketId] : []))],
    [searchTicketIds, ticketId],
  );
  const [orderId, setOrderId] = useState(searchOrderId ?? "");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const ticket = tickets[0] ?? null;
  const [tourTitle, setTourTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<(typeof paymentMethods)[number]["id"]>("vnpay");
  const [remaining, setRemaining] = useState(0);
  const preserveTicketRef = useRef(false);
  const routeMountedRef = useRef(false);

  const client = supabase as unknown as SupabaseClient;

  const transitionTicket = useCallback(
    async (currentOrderId: string, status: "expired" | "cancelled") => {
      const result = await closeTicketOrder({
        data: { orderId: currentOrderId, status },
      });
      return result.status;
    },
    [],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      if (searchOrderId || ticketIds.length) {
        toast.error("Please sign in again to access this booking.");
        void navigate({ to: "/tours", replace: true });
      }
      return;
    }
    if (!searchOrderId && !ticketIds.length) {
      setLoading(false);
      toast.error("The checkout link is missing its ticket ID.");
      void navigate({ to: "/tours", replace: true });
      return;
    }

    const currentUser = user;
    let active = true;
    async function loadTicket() {
      setLoading(true);
      try {
        let query = client
          .from("ticket")
          .select(
            "id, order_id, tour_id, user_id, ticket_status, pickup_location, seat_numbers, addons, price, travel_date, created_at",
          )
          .eq("user_id", currentUser.id);
        query = searchOrderId ? query.eq("order_id", searchOrderId) : query.in("id", ticketIds);
        const { data, error } = await query;
        if (error) throw error;
        if (!data || (!searchOrderId && data.length !== ticketIds.length) || data.length === 0) {
          if (active) {
            toast.error("One or more tickets are no longer available.");
            void navigate({ to: "/tours", replace: true });
          }
          return;
        }

        const loadedTickets = data as Ticket[];
        const currentOrderId = searchOrderId ?? loadedTickets[0]!.order_id;
        if (!currentOrderId || loadedTickets.some((item) => item.order_id !== currentOrderId)) {
          throw new Error("The checkout tickets do not belong to one order.");
        }
        if (loadedTickets.some((item) => item.ticket_status !== "pending")) {
          if (active) {
            toast.error("One or more tickets are no longer awaiting payment.");
            void navigate({ to: "/my-bookings", replace: true });
          }
          return;
        }
        const createdAt = Math.min(
          ...loadedTickets.map((item) => new Date(item.created_at).getTime()),
        );
        if (!Number.isFinite(createdAt) || createdAt + HOLD_DURATION_MS <= Date.now()) {
          const result = await transitionTicket(currentOrderId, "expired");
          if (active && result === "expired") {
            toast.error("Đã hết thời gian giữ vé.");
            void navigate({ to: "/my-bookings", replace: true });
            return;
          }
        }

        const { data: tour, error: tourError } = await client
          .from("Tour")
          .select("tour_name")
          .eq("tour_id", loadedTickets[0]!.tour_id)
          .maybeSingle();
        if (tourError) throw tourError;
        if (active) {
          setOrderId(currentOrderId);
          setTickets(loadedTickets);
          setTourTitle(
            typeof tour?.["tour_name"] === "string" ? tour["tour_name"] : "Tour booking",
          );
        }
      } catch (error) {
        console.error("Unable to load checkout ticket:", error);
        if (active) {
          toast.error(error instanceof Error ? error.message : "Unable to load this booking.");
          void navigate({ to: "/tours", replace: true });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTicket();
    return () => {
      active = false;
    };
  }, [authLoading, client, navigate, searchOrderId, ticketIds, transitionTicket, user]);

  useEffect(() => {
    if (!ticket || ticket.ticket_status !== "pending" || !user || !orderId) {
      routeMountedRef.current = false;
      return;
    }

    routeMountedRef.current = true;
    return () => {
      routeMountedRef.current = false;
      window.setTimeout(() => {
        if (routeMountedRef.current || preserveTicketRef.current) return;
        void transitionTicket(orderId, "cancelled").catch((error: unknown) => {
          console.error("Unable to cancel ticket after leaving checkout:", error);
          toast.error("Unable to cancel your ticket. It will expire automatically.");
        });
      }, 0);
    };
  }, [orderId, ticket, transitionTicket, user]);

  const finishTicket = useCallback(
    async (status: "expired" | "cancelled") => {
      if (!ticket || !user || !orderId || busy) return;
      preserveTicketRef.current = true;
      setBusy(true);
      try {
        const finalStatus = await transitionTicket(orderId, status);
        if (finalStatus === "pending") {
          preserveTicketRef.current = false;
          toast.error("The hold has not expired yet. Please try again shortly.");
          return;
        }
        if (finalStatus === "expired") {
          toast.success("Đã hết thời gian giữ vé.");
        } else if (finalStatus === "cancelled") {
          toast.success("Ticket hold cancelled.");
        }
        await navigate({ to: "/my-bookings", replace: true });
      } catch (error) {
        preserveTicketRef.current = false;
        console.error("Unable to update ticket status:", error);
        toast.error(error instanceof Error ? error.message : "Unable to update this ticket.");
      } finally {
        setBusy(false);
      }
    },
    [busy, navigate, orderId, ticket, transitionTicket, user],
  );

  useEffect(() => {
    if (!ticket || ticket.ticket_status !== "pending") return;
    const handleBrowserBack = () => {
      void finishTicket("cancelled");
    };
    window.addEventListener("popstate", handleBrowserBack);
    return () => window.removeEventListener("popstate", handleBrowserBack);
  }, [finishTicket, ticket]);

  useEffect(() => {
    if (!ticket || ticket.ticket_status !== "pending") return;
    const expiresAt =
      Math.min(...tickets.map((item) => new Date(item.created_at).getTime())) + HOLD_DURATION_MS;
    const updateRemaining = () => {
      const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(secondsLeft);
      if (secondsLeft === 0) void finishTicket("expired");
    };

    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timerId);
  }, [finishTicket, ticket, tickets]);

  const pay = async () => {
    if (!ticket || !user || !orderId || busy) return;
    const selectedPaymentMethod = method;
    const expiresAt =
      Math.min(...tickets.map((item) => new Date(item.created_at).getTime())) + HOLD_DURATION_MS;
    if (Date.now() >= expiresAt) {
      void finishTicket("expired");
      return;
    }

    setBusy(true);
    try {
      const result = await confirmTicketPayment({
        data: { orderId, paymentMethod: selectedPaymentMethod },
      });

      if (result.status === "expired") {
        preserveTicketRef.current = true;
        toast.error("Đã hết thời gian giữ vé.");
        await navigate({ to: "/my-bookings", replace: true });
        return;
      }

      preserveTicketRef.current = true;
      toast.success(
        result.alreadyPaid
          ? "This demo payment was already confirmed for this booking."
          : "Demo payment confirmed. Your booking is marked as paid.",
      );
      if (result.ticketIssueStatus === "pending_issue") {
        toast.info("Payment is confirmed. Ticket issuance is pending.");
      }
      await navigate({
        to: "/eticket/$orderId",
        params: { orderId },
      });
    } catch (error) {
      console.error("Lỗi thanh toán:", error);
      toast.error(error instanceof Error ? error.message : "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  const expired = remaining === 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-5">
          <Link to="/tours">
            <ArrowLeft className="size-4" aria-hidden /> Back to tours
          </Link>
        </Button>

        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Checkout</h1>
        {loading ? (
          <div className="grid min-h-64 place-items-center" role="status">
            <Loader2 className="size-8 animate-spin text-primary" aria-label="Loading checkout" />
          </div>
        ) : ticket ? (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
              <Timer className="size-5 text-accent" aria-hidden />
              <span className="font-semibold">{expired ? "Hold expired" : "Ticket held for"}</span>
              <span className="font-mono text-lg font-bold tabular-nums" aria-live="polite">
                {minutes}:{seconds}
              </span>
              <span className="text-sm text-muted-foreground">
                {expired
                  ? "This ticket is being released."
                  : "Complete payment before the timer ends."}
              </span>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-lg font-bold">Booking details</h2>
                <p className="mt-3 text-base font-semibold">{tourTitle}</p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <BookingDetail
                    label="Travel date"
                    value={ticket.travel_date ?? "Not specified"}
                  />
                  <BookingDetail label="Ticket quantity" value={String(tickets.length)} />
                  <BookingDetail
                    label="Pickup location"
                    value={ticket.pickup_location || "Not specified"}
                  />
                  <BookingDetail label="Ticket status" value={t(ticket.ticket_status)} />
                </dl>
              </section>

              <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-lg font-bold">Payment method</h2>
                <p
                  role="status"
                  className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-muted-foreground"
                >
                  Demo payment only. No real payment is collected or sent to a payment provider.
                </p>
                <div className="mt-4 grid gap-2">
                  {paymentMethods.map(({ id, label, Icon }) => (
                    <label
                      key={id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                        method === id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value={id}
                        checked={method === id}
                        onChange={() => setMethod(id)}
                        className="accent-primary"
                      />
                      <Icon className="size-4" aria-hidden />
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                  ))}
                </div>
                {method === "bank_transfer" && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                    <QrCode className="size-5 shrink-0" aria-hidden />
                    Mock bank-transfer QR payment
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="font-medium">Total</span>
                  <span className="font-display text-xl font-extrabold">
                    {formatPrice(tickets.reduce((total, item) => total + Number(item.price), 0))}
                  </span>
                </div>
                <Button
                  variant="cta"
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => void pay()}
                  disabled={busy || expired}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Banknote className="size-4" aria-hidden />
                  )}
                  {busy ? "Processing..." : "Pay"}
                </Button>
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => void finishTicket("cancelled")}
                  disabled={busy}
                >
                  Cancel booking
                </Button>
              </aside>
            </div>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function BookingDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
