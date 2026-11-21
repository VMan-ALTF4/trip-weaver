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
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { isBookingProfileComplete } from "@/lib/booking-profile";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, type Currency } from "@/lib/currency";
import { useLanguage } from "@/lib/language";
import { closeTicketOrder, confirmTicketPayment } from "@/lib/payments.functions";
import vnpayLogo from "@/assets/payments/vnpay.png";
import momoLogo from "@/assets/payments/momo.png";
import paypalLogo from "@/assets/payments/paypal.png";

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

export type PaymentMethodId = "vnpay" | "momo" | "card" | "bank_transfer" | "paypal";

type PaymentMethodOption = {
  id: PaymentMethodId;
  label: string;
  logo?: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
};

const paymentMethodsByCurrency: Record<Currency, readonly PaymentMethodOption[]> = {
  VND: [
    { id: "vnpay", label: "VNPay", logo: vnpayLogo, Icon: Wallet },
    { id: "momo", label: "Momo", logo: momoLogo, Icon: Wallet },
    { id: "card", label: "Credit / Debit Card", Icon: CreditCard },
    { id: "bank_transfer", label: "Bank Transfer", Icon: Building2 },
  ],
  USD: [
    { id: "paypal", label: "PayPal", logo: paypalLogo, Icon: Wallet },
    { id: "card", label: "Credit / Debit Card", Icon: CreditCard },
    { id: "bank_transfer", label: "Bank Transfer", Icon: Building2 },
  ],
};

function PaymentMethodIcon({
  label,
  logo,
  Icon,
}: {
  label: string;
  logo?: string;
  Icon: PaymentMethodOption["Icon"];
}) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-white p-0.5">
      {logo ? (
        <img
          src={logo}
          alt={label}
          width={24}
          height={24}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
    </span>
  );
}

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
        content: "Review your booking and pay with VNPay, Momo, Paypal, card or bank transfer.",
      },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useLanguage();
  const { currency, formatPrice } = useCurrency();
  const {
    user,
    profile,
    loading: authLoading,
    profileLoading,
    openProfileEditor,
    refreshAuthProfile,
  } = useAuth();
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
  const availableMethods = useMemo(
    () => paymentMethodsByCurrency[currency] ?? paymentMethodsByCurrency.VND,
    [currency],
  );
  const [orderId, setOrderId] = useState(searchOrderId ?? "");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const ticket = tickets[0] ?? null;
  const [tourTitle, setTourTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<PaymentMethodId>(() => {
    return currency === "USD" ? "paypal" : "vnpay";
  });
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!availableMethods.some((item) => item.id === method)) {
      setMethod(availableMethods[0]?.id ?? "card");
    }
  }, [availableMethods, method]);

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
        toast.error(t("Please sign in again to access this booking."));
        void navigate({ to: "/tours", replace: true });
      }
      return;
    }
    if (!searchOrderId && !ticketIds.length) {
      setLoading(false);
      toast.error(t("The checkout link is missing its ticket ID."));
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
            toast.error(t("One or more tickets are no longer available."));
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
            toast.error(t("One or more tickets are no longer awaiting payment."));
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
            toast.error(t("Hold expired"));
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
          toast.error(error instanceof Error ? error.message : t("Unable to load this booking."));
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
  }, [authLoading, client, navigate, searchOrderId, t, ticketIds, transitionTicket, user]);

  const finishTicket = useCallback(
    async (status: "expired" | "cancelled") => {
      if (!ticket || !user || !orderId || busy) return;
      setBusy(true);
      try {
        const finalStatus = await transitionTicket(orderId, status);
        if (finalStatus === "pending") {
          toast.error(t("The hold has not expired yet. Please try again shortly."), {
            id: "checkout-hold-not-expired",
            duration: 5000,
          });
          return;
        }
        if (finalStatus === "expired") {
          toast.success(t("Hold expired"));
        } else if (finalStatus === "cancelled") {
          toast.success(t("Ticket hold cancelled."));
        }
        await navigate({ to: "/my-bookings", replace: true });
      } catch (error) {
        console.error("Unable to update ticket status:", error);
        toast.error(error instanceof Error ? error.message : t("Unable to update this ticket."));
      } finally {
        setBusy(false);
      }
    },
    [busy, navigate, orderId, t, ticket, transitionTicket, user],
  );

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
    if (
      profileLoading ||
      !isBookingProfileComplete(profile?.sdt, user.email_confirmed_at, user.new_email)
    ) {
      openProfileEditor({ requirePhone: true });
      return;
    }

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
        toast.error(t("Hold expired"));
        await navigate({ to: "/my-bookings", replace: true });
        return;
      }

      toast.success(
        result.alreadyPaid
          ? t("This demo payment was already confirmed for this booking.")
          : t("Demo payment confirmed. Your booking is marked as paid."),
      );
      if (result.ticketIssueStatus === "pending_issue") {
        toast.info(t("Payment is confirmed. Ticket issuance is pending."));
      }
      await navigate({
        to: "/eticket/$orderId",
        params: { orderId },
      });
    } catch (error) {
      console.error("Lỗi thanh toán:", error);
      if (error instanceof Error && error.message.includes("PROFILE_INCOMPLETE")) {
        try {
          await refreshAuthProfile();
        } catch (refreshError) {
          console.error("Unable to refresh profile after payment eligibility check.", refreshError);
        }
        openProfileEditor({ requirePhone: true });
        toast.error(t("Please add a phone number and verify your email before payment."));
        return;
      }
      toast.error(error instanceof Error ? t(error.message) : t("Payment could not be completed."));
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
            <ArrowLeft className="size-4" aria-hidden /> {t("Back to tours")}
          </Link>
        </Button>

        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{t("Checkout")}</h1>
        {loading ? (
          <div className="grid min-h-64 place-items-center" role="status">
            <Loader2
              className="size-8 animate-spin text-primary"
              aria-label={t("Loading checkout")}
            />
          </div>
        ) : ticket ? (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
              <Timer className="size-5 text-accent" aria-hidden />
              <span className="font-semibold">
                {expired ? t("Hold expired") : t("Ticket held for")}
              </span>
              <span className="font-mono text-lg font-bold tabular-nums" aria-live="polite">
                {minutes}:{seconds}
              </span>
              <span className="text-sm text-muted-foreground">
                {expired
                  ? t("This ticket is being released.")
                  : t("Complete payment before the timer ends.")}
              </span>
            </div>

            {!profileLoading &&
              !isBookingProfileComplete(
                profile?.sdt,
                user?.email_confirmed_at,
                user?.new_email,
              ) && (
                <div
                  role="alert"
                  className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
                >
                  <p className="text-sm font-medium">
                    {t("Please add a phone number and verify your email before payment.")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openProfileEditor({ requirePhone: true })}
                  >
                    {t("Complete profile")}
                  </Button>
                </div>
              )}

            <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-lg font-bold">{t("Booking details")}</h2>
                <p className="mt-3 text-base font-semibold">{tourTitle}</p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <BookingDetail
                    label={t("Travel date")}
                    value={ticket.travel_date ?? t("Not specified")}
                  />
                  <BookingDetail label={t("Ticket quantity")} value={String(tickets.length)} />
                  <BookingDetail
                    label={t("Pickup location")}
                    value={ticket.pickup_location || t("Not specified")}
                  />
                  <BookingDetail label={t("Ticket status")} value={t(ticket.ticket_status)} />
                </dl>
              </section>

              <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-lg font-bold">{t("Payment method")}</h2>
                <p
                  role="status"
                  className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-muted-foreground"
                >
                  {t(
                    "Demo payment only. No real payment is collected or sent to a payment provider.",
                  )}
                </p>
                <div className="mt-4 grid gap-2">
                  {availableMethods.map(({ id, label, logo, Icon }) => (
                    <label
                      key={id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
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
                      <PaymentMethodIcon label={label} logo={logo} Icon={Icon} />
                      <span className="text-sm font-medium">{t(label)}</span>
                    </label>
                  ))}
                </div>
                {method === "bank_transfer" && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                    <QrCode className="size-5 shrink-0" aria-hidden />
                    {t("Mock bank-transfer QR payment")}
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="font-medium">{t("Total")}</span>
                  <span className="font-display text-xl font-extrabold">
                    {formatPrice(tickets.reduce((total, item) => total + Number(item.price), 0))}
                  </span>
                </div>
                <Button
                  variant="cta"
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => void pay()}
                  disabled={
                    busy ||
                    expired ||
                    profileLoading ||
                    !isBookingProfileComplete(
                      profile?.sdt,
                      user?.email_confirmed_at,
                      user?.new_email,
                    )
                  }
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Banknote className="size-4" aria-hidden />
                  )}
                  {busy ? t("Processing...") : t("Pay")}
                </Button>
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => void finishTicket("cancelled")}
                  disabled={busy}
                >
                  {t("Cancel booking")}
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
